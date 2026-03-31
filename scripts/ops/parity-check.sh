#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRETS_FILE="${HOME}/.config/codex-secrets/railway.env"
GRAPHQL_URL="https://backboard.railway.com/graphql/v2"

PROD_URL="https://2026gpt.jardenberg.se"
STAGE_URL="https://stage2026gpt.jardenberg.se"

PROD_ENV_ID="555086f4-095c-4ba6-bcf7-b1935d6df21a"
STAGE_ENV_ID="806b8e4c-dc76-412a-adf2-a25ff788cae9"

PROD_SERVICE_ID="89baa974-4804-44e0-b45f-0f586fb62077"
STAGE_SERVICE_ID="d1d4951b-8ec8-48b8-9e8c-fb4e0ff78c6f"

EXPECTED_REPO="jardenberg/2026gpt"
EXPECTED_CONFIG_PATH="https://raw.githubusercontent.com/jardenberg/2026GPT/main/config/librechat.yaml"
EXPECTED_PROD_TITLE="2026GPT"
EXPECTED_STAGE_TITLE="2026GPT Staging"
EXPECTED_PROD_FOOTER="Big Truck Co — Enterprise AI"
EXPECTED_STAGE_FOOTER="Big Truck Co — Enterprise AI | STAGING"

FAILURES=0

log() {
  printf '%s\n' "$*"
}

pass() {
  printf 'PASS %s\n' "$*"
}

fail() {
  printf 'FAIL %s\n' "$*"
  FAILURES=$((FAILURES + 1))
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  }
}

load_tokens() {
  if [[ -f "${SECRETS_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${SECRETS_FILE}"
  fi

  : "${RAILWAY_TOKEN_PRODUCTION:?Set RAILWAY_TOKEN_PRODUCTION or create ${SECRETS_FILE}}"
  : "${RAILWAY_TOKEN_STAGING:?Set RAILWAY_TOKEN_STAGING or create ${SECRETS_FILE}}"
}

graphql_service_instance() {
  local token="$1"
  local service_id="$2"
  local environment_id="$3"
  local payload

  payload="$(jq -n \
    --arg serviceId "${service_id}" \
    --arg environmentId "${environment_id}" \
    '{
      query: "query($serviceId:String!,$environmentId:String!){ serviceInstance(environmentId:$environmentId, serviceId:$serviceId){ serviceName rootDirectory dockerfilePath builder source { image repo } } }",
      variables: {
        serviceId: $serviceId,
        environmentId: $environmentId
      }
    }')"

  curl -fsS "${GRAPHQL_URL}" \
    -H 'Content-Type: application/json' \
    -H "Project-Access-Token: ${token}" \
    --data "${payload}" | jq '.data.serviceInstance'
}

service_statuses() {
  local token="$1"
  local environment="$2"

  RAILWAY_TOKEN="${token}" railway service status -a -e "${environment}" --json
}

service_vars() {
  local token="$1"
  local service_name="$2"
  local environment="$3"

  RAILWAY_TOKEN="${token}" railway variables --json -s "${service_name}" -e "${environment}"
}

check_service_instance() {
  local label="$1"
  local token="$2"
  local service_id="$3"
  local environment_id="$4"
  local expected_service_name="$5"

  local instance
  instance="$(graphql_service_instance "${token}" "${service_id}" "${environment_id}")"

  local service_name root_directory repo image
  service_name="$(jq -r '.serviceName' <<<"${instance}")"
  root_directory="$(jq -r '.rootDirectory' <<<"${instance}")"
  repo="$(jq -r '.source.repo // ""' <<<"${instance}")"
  image="$(jq -r '.source.image // ""' <<<"${instance}")"

  [[ "${service_name}" == "${expected_service_name}" ]] && pass "${label} service name = ${service_name}" || fail "${label} service name = ${service_name}"
  [[ "${root_directory}" == "." ]] && pass "${label} rootDirectory = ." || fail "${label} rootDirectory = ${root_directory}"
  [[ "${repo}" == "${EXPECTED_REPO}" ]] && pass "${label} source.repo = ${EXPECTED_REPO}" || fail "${label} source.repo = ${repo}"
  [[ -z "${image}" ]] && pass "${label} source.image cleared" || fail "${label} source.image still set = ${image}"
}

check_service_rollout() {
  local label="$1"
  local token="$2"
  local environment="$3"

  local statuses
  statuses="$(service_statuses "${token}" "${environment}")"

  local failing
  failing="$(jq -r '.[] | select(.status != "SUCCESS" or .stopped == true) | "\(.name)=\(.status) stopped=\(.stopped)"' <<<"${statuses}")"

  if [[ -z "${failing}" ]]; then
    pass "${label} all Railway services SUCCESS"
  else
    fail "${label} service issues: ${failing}"
  fi
}

http_code() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' "${url}"
}

config_json() {
  local url="$1"
  curl -fsS "${url}/api/config"
}

check_health() {
  local label="$1"
  local url="$2"
  local code
  code="$(http_code "${url}/health")"

  [[ "${code}" == "200" ]] && pass "${label} /health = 200" || fail "${label} /health = ${code}"
}

check_config_fields() {
  local label="$1"
  local url="$2"
  local expected_title="$3"
  local expected_footer="$4"
  local expected_domain="$5"

  local config
  config="$(config_json "${url}")"

  local title footer domain social_login
  title="$(jq -r '.appTitle' <<<"${config}")"
  footer="$(jq -r '.customFooter' <<<"${config}")"
  domain="$(jq -r '.serverDomain' <<<"${config}")"
  social_login="$(jq -r '.socialLoginEnabled' <<<"${config}")"

  [[ "${title}" == "${expected_title}" ]] && pass "${label} appTitle = ${expected_title}" || fail "${label} appTitle = ${title}"
  [[ "${footer}" == "${expected_footer}" ]] && pass "${label} customFooter ok" || fail "${label} customFooter = ${footer}"
  [[ "${domain}" == "${expected_domain}" ]] && pass "${label} serverDomain ok" || fail "${label} serverDomain = ${domain}"
  [[ "${social_login}" == "true" ]] && pass "${label} socialLoginEnabled = true" || fail "${label} socialLoginEnabled = ${social_login}"
}

check_expected_vars() {
  local label="$1"
  local token="$2"
  local service_name="$3"
  local environment="$4"
  local expected_title="$5"
  local expected_footer="$6"
  local expected_domain="$7"

  local vars
  vars="$(service_vars "${token}" "${service_name}" "${environment}")"

  local config_path title footer domain_client domain_server
  config_path="$(jq -r '.CONFIG_PATH' <<<"${vars}")"
  title="$(jq -r '.APP_TITLE' <<<"${vars}")"
  footer="$(jq -r '.CUSTOM_FOOTER' <<<"${vars}")"
  domain_client="$(jq -r '.DOMAIN_CLIENT' <<<"${vars}")"
  domain_server="$(jq -r '.DOMAIN_SERVER' <<<"${vars}")"

  [[ "${config_path}" == "${EXPECTED_CONFIG_PATH}" ]] && pass "${label} CONFIG_PATH on main" || fail "${label} CONFIG_PATH = ${config_path}"
  [[ "${title}" == "${expected_title}" ]] && pass "${label} APP_TITLE ok" || fail "${label} APP_TITLE = ${title}"
  [[ "${footer}" == "${expected_footer}" ]] && pass "${label} CUSTOM_FOOTER ok" || fail "${label} CUSTOM_FOOTER = ${footer}"
  [[ "${domain_client}" == "${expected_domain}" ]] && pass "${label} DOMAIN_CLIENT ok" || fail "${label} DOMAIN_CLIENT = ${domain_client}"
  [[ "${domain_server}" == "${expected_domain}" ]] && pass "${label} DOMAIN_SERVER ok" || fail "${label} DOMAIN_SERVER = ${domain_server}"
}

check_head_assets() {
  local label="$1"
  local url="$2"
  local html

  html="$(curl -fsS "${url}")"

  local patterns=(
    'assets/favicon.ico'
    'assets/favicon-32x32.png'
    'assets/favicon-16x16.png'
    'assets/apple-touch-icon-180x180.png'
    'manifest.webmanifest'
    'registerSW.js'
  )

  local pattern
  for pattern in "${patterns[@]}"; do
    if grep -Fq "${pattern}" <<<"${html}"; then
      pass "${label} head includes ${pattern}"
    else
      fail "${label} head missing ${pattern}"
    fi
  done

  if grep -Fq 'custom.css' <<<"${html}"; then
    fail "${label} still serves custom.css"
  else
    pass "${label} custom.css not served"
  fi
}

favicon_hash() {
  local url="$1"
  curl -fsS "${url}/assets/favicon-32x32.png" | shasum -a 256 | awk '{print $1}'
}

main() {
  require_command curl
  require_command jq
  require_command railway
  require_command shasum
  load_tokens

  log "== 2026GPT parity check =="

  check_service_instance "prod" "${RAILWAY_TOKEN_PRODUCTION}" "${PROD_SERVICE_ID}" "${PROD_ENV_ID}" "LibreChat"
  check_service_instance "stage" "${RAILWAY_TOKEN_STAGING}" "${STAGE_SERVICE_ID}" "${STAGE_ENV_ID}" "2026GPT Staging"

  check_service_rollout "prod" "${RAILWAY_TOKEN_PRODUCTION}" "production"
  check_service_rollout "stage" "${RAILWAY_TOKEN_STAGING}" "staging"

  check_expected_vars "prod" "${RAILWAY_TOKEN_PRODUCTION}" "LibreChat" "production" "${EXPECTED_PROD_TITLE}" "${EXPECTED_PROD_FOOTER}" "${PROD_URL}"
  check_expected_vars "stage" "${RAILWAY_TOKEN_STAGING}" "2026GPT Staging" "staging" "${EXPECTED_STAGE_TITLE}" "${EXPECTED_STAGE_FOOTER}" "${STAGE_URL}"

  check_health "prod" "${PROD_URL}"
  check_health "stage" "${STAGE_URL}"

  check_config_fields "prod" "${PROD_URL}" "${EXPECTED_PROD_TITLE}" "${EXPECTED_PROD_FOOTER}" "${PROD_URL}"
  check_config_fields "stage" "${STAGE_URL}" "${EXPECTED_STAGE_TITLE}" "${EXPECTED_STAGE_FOOTER}" "${STAGE_URL}"

  check_head_assets "prod" "${PROD_URL}"
  check_head_assets "stage" "${STAGE_URL}"

  local prod_hash stage_hash
  prod_hash="$(favicon_hash "${PROD_URL}")"
  stage_hash="$(favicon_hash "${STAGE_URL}")"

  if [[ "${prod_hash}" == "${stage_hash}" ]]; then
    pass "favicon hashes match (${prod_hash})"
  else
    fail "favicon hashes differ: prod=${prod_hash} stage=${stage_hash}"
  fi

  if (( FAILURES > 0 )); then
    log
    log "Parity check finished with ${FAILURES} failure(s)."
    exit 1
  fi

  log
  log "Parity check finished cleanly."
}

main "$@"

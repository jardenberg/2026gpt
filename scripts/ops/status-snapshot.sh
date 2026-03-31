#!/usr/bin/env bash

set -euo pipefail

SECRETS_FILE="${HOME}/.config/codex-secrets/railway.env"
GRAPHQL_URL="https://backboard.railway.com/graphql/v2"

PROD_URL="https://2026gpt.jardenberg.se"
STAGE_URL="https://stage2026gpt.jardenberg.se"

PROD_ENV_ID="555086f4-095c-4ba6-bcf7-b1935d6df21a"
STAGE_ENV_ID="806b8e4c-dc76-412a-adf2-a25ff788cae9"

PROD_SERVICE_ID="89baa974-4804-44e0-b45f-0f586fb62077"
STAGE_SERVICE_ID="d1d4951b-8ec8-48b8-9e8c-fb4e0ff78c6f"

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

config_summary() {
  local url="$1"
  curl -fsS "${url}/api/config" | jq '{appTitle, serverDomain, socialLoginEnabled, customFooter}'
}

print_section() {
  printf '\n## %s\n' "$1"
}

main() {
  require_command curl
  require_command jq
  require_command railway
  load_tokens

  printf '2026GPT status snapshot\n'
  printf 'Generated: %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

  print_section "Production services"
  service_statuses "${RAILWAY_TOKEN_PRODUCTION}" "production" | jq -r '.[] | "\(.name)\t\(.status)\t\(.deploymentId)"'

  print_section "Staging services"
  service_statuses "${RAILWAY_TOKEN_STAGING}" "staging" | jq -r '.[] | "\(.name)\t\(.status)\t\(.deploymentId)"'

  print_section "LibreChat source metadata"
  printf 'prod: '
  graphql_service_instance "${RAILWAY_TOKEN_PRODUCTION}" "${PROD_SERVICE_ID}" "${PROD_ENV_ID}" | jq -c '{serviceName, rootDirectory, builder, source}'
  printf 'stage: '
  graphql_service_instance "${RAILWAY_TOKEN_STAGING}" "${STAGE_SERVICE_ID}" "${STAGE_ENV_ID}" | jq -c '{serviceName, rootDirectory, builder, source}'

  print_section "LibreChat key variables"
  printf 'prod: '
  service_vars "${RAILWAY_TOKEN_PRODUCTION}" "LibreChat" "production" | jq -c '{CONFIG_PATH, APP_TITLE, CUSTOM_FOOTER, DOMAIN_CLIENT, DOMAIN_SERVER}'
  printf 'stage: '
  service_vars "${RAILWAY_TOKEN_STAGING}" "2026GPT Staging" "staging" | jq -c '{CONFIG_PATH, APP_TITLE, CUSTOM_FOOTER, DOMAIN_CLIENT, DOMAIN_SERVER}'

  print_section "Live config summary"
  printf 'prod: '
  config_summary "${PROD_URL}" | jq -c .
  printf 'stage: '
  config_summary "${STAGE_URL}" | jq -c .

  print_section "Health"
  printf 'prod: %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' "${PROD_URL}/health")"
  printf 'stage: %s\n' "$(curl -sS -o /dev/null -w '%{http_code}' "${STAGE_URL}/health")"
}

main "$@"

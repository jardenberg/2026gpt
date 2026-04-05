import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Spinner } from '@librechat/client';
import {
  bootstrapPolicyAnalystAuth,
  fetchPolicyAnalystConfig,
  readStoredPolicyAnalystDocs,
} from '~/utils/policyAnalyst';

export default function PolicyAnalystPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const docs = useMemo(() => readStoredPolicyAnalystDocs(), []);
  const authBootstrapQuery = useQuery({
    queryKey: ['policy-analyst-auth'],
    queryFn: bootstrapPolicyAnalystAuth,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const authToken = authBootstrapQuery.data ?? null;
  const configQuery = useQuery({
    queryKey: ['policy-analyst-config', authToken],
    queryFn: () => fetchPolicyAnalystConfig(authToken),
    staleTime: 60_000,
    retry: false,
    enabled: !authBootstrapQuery.isLoading,
  });

  if (authBootstrapQuery.isLoading || configQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-6">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (authBootstrapQuery.isError || configQuery.isError) {
    return (
      <div className="px-4 py-6 text-sm text-[#7d2d2d]">
        Policy Analyst configuration is temporarily unavailable.
      </div>
    );
  }

  if (!configQuery.data?.enabled) {
    return (
      <div className="px-4 py-6 text-sm text-text-secondary">
        Policy Analyst is not enabled in this environment.
      </div>
    );
  }

  const onWorkspace = location.pathname === '/policy-analyst';

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-4 text-text-primary">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b6949]">
          Workflow
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Policy Analyst</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Upload one policy PDF, ask grounded questions, and get answers with page citations.
        </p>
      </div>

      <div className="rounded-3xl border border-border-light bg-surface-secondary px-4 py-4">
        <div className="text-sm font-medium text-text-primary">Current session</div>
        <div className="mt-2 text-sm text-text-secondary">
          {docs.length === 0
            ? 'No staged policy documents yet.'
            : `${docs.length} document${docs.length === 1 ? '' : 's'} ready in this browser.`}
        </div>
      </div>

      <Button
        className="justify-center rounded-full"
        onClick={() => navigate('/policy-analyst')}
        disabled={onWorkspace}
      >
        {onWorkspace ? 'Policy Analyst open' : 'Open Policy Analyst'}
      </Button>
    </div>
  );
}

/** Channel Monitor V2 (user + admin passive monitor UI) */
export default {
  channelMonitorV2: {
    title: 'Channel Monitor',
    updating: 'Updating data',
    updatedTo: 'Updated to {time}',
    partialCoverage: 'Partial historical coverage',
    bootstrap: {
      title: 'Building historical monitor data',
      description:
        'On first enable, passive aggregation silently fills the 90m, 24h, 7d, and 30d windows in the background. All ranges become complete once this finishes.',
      progress: '{percent}% complete',
      working: 'Aggregating in the background…',
    },
    timeRange: 'Time range',
    clearFilters: 'Reset',
    refreshingFilters: 'Filters changed; refreshing matrix, trend, and details…',
    switchingData: 'Switching filtered data…',
    summaryAria: 'Selected range summary',
    loadFailed: 'Failed to load channel monitor',
    detailLoadFailed: 'Failed to load channel monitor details',
    otherModels: 'Other models',
    ignored: 'Ignored',
    currentUser: 'Current user',
    ranges: { '90m': '90m', '24h': '24h', '7d': '7d', '30d': '30d' },
    filters: {
      platform: 'Platform', allPlatforms: 'All', group: 'Group', allGroups: 'All', model: 'Model', allModels: 'All',
      empty: 'No options', selectedCount: '{count}', labelValue: '{label}: {value}'
    },
    groupBy: {
      label: 'Group by', platform: 'Platform', platformGroup: 'Platform / Group', platformModel: 'Platform / Model', platformGroupModel: 'Platform / Group / Model'
    },
    trendView: { label: 'Trend view', pulse: 'Pulse matrix', line: 'Line chart' },
    healthMode: { label: 'Health display', overall: 'Overall', success: 'Error rate', ttft: 'First token', cache: 'Cache rate' },
    tabs: { aria: 'Detail dimension', models: 'Models', errors: 'Error reasons', users: 'User ranking' },
    metrics: {
      rpm: 'RPM',
      tpm: 'TPM',
      tps: 'Tokens/s',
      rpmDetail: 'Requests per minute',
      tpmDetail: 'Tokens per minute',
      tpsDetail: 'Derived as TPM ÷ 60',
      errorRate: 'Error rate',
      ttft: 'First token',
      ttftP50: 'First token P50',
      durationP50: 'Duration P50',
      cacheRate: 'Cache rate',
      cacheDetail: 'Read cache share',
      successRate: 'Success rate',
      successRateValue: 'Success rate {value}',
      errorRateValue: 'Error rate {value}',
      rpmValue: 'RPM {value}',
      tpmValue: 'TPM {value}',
      tpsValue: 'Tokens/s {value}',
      ttftValue: 'First token {value}',
      durationValue: 'Duration {value}',
      cacheRateValue: 'Cache rate {value}',
    },
    table: { platformModel: 'Platform / Model', rank: 'Rank', user: 'User' },
    empty: { title: 'No data to display', description: 'Try changing the time range or filters' },
    bucket: { minutes: '{count}-minute buckets', hours: '{count}-hour buckets', days: '{count}-day buckets' },
    matrix: {
      title: 'Availability trend', description: 'Each row is a channel dimension and each block is an aggregate interval; hover for details', wheelZoom: 'Scroll over blocks to zoom in (narrower range, wider blocks)', wheelZoomX: 'Scroll over blocks to zoom in (narrower range, wider blocks)', dimension: 'Channel dimension', emptyTitle: 'No matrix data for the selected window', legendAria: 'Health score legend', bad: 'Bad', good: 'Good', healthyLegend: 'Healthy (≥80)', warningLegend: 'Watch (50–79)', criticalLegend: 'Critical (<50)', unknownLegend: 'No traffic / insufficient samples', noTraffic: 'No traffic in this interval', noTrafficAt: '{time} · no traffic', scoreLine: 'Health score {score}', resetZoom: 'Reset zoom'
    },
    chart: {
      title: 'Availability trend', description: 'Smoothed trend: error rate · first token P50 · cache rate', emptyTitle: 'No trend data for the selected window', errorLegend: 'Error rate (left axis %)', cacheLegend: 'Cache rate (left axis %)', ttftLegend: 'First token P50 (right axis)', errorDataset: 'Error rate trend %', cacheDataset: 'Cache rate trend %', ttftDataset: 'First token trend P50 (ms)', percentAxis: 'Rate %', resetZoom: 'Reset zoom'
    },
    errorDetail: { http: 'HTTP {code}', upstream: 'Upstream {code}', noMessage: 'No error message', empty: 'Category rates only (sample messages are admin-only)' },
    errorCategories: {
      content_policy: 'Content policy', authentication: 'Authentication', context_limit: 'Context limit', invalid_request: 'Invalid request', model_unsupported: 'Unsupported model', group_access: 'Group access', quota_or_balance: 'Quota or balance', account_pool_unavailable: 'Account pool unavailable', rate_or_capacity: 'Rate or capacity', timeout: 'Timeout', transport_or_stream: 'Transport or stream', upstream_forbidden: 'Upstream forbidden', not_found: 'Not found', client_cancelled: 'Client cancelled', upstream_5xx: 'Upstream 5xx', internal: 'Internal', other: 'Other'
    },
    rank: {
      gold: 'Rank 1 gold',
      silver: 'Rank 2 silver',
      bronze: 'Rank 3 bronze',
      place: 'Rank {n}',
      unranked: 'Unranked',
    },
  },
}

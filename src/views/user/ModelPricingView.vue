<template>
  <AppLayout>
    <div class="pricing-page space-y-5">

      <section class="pricing-toolbar card">
        <div class="pricing-search">
          <Icon name="search" size="md" />
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('modelPricing.searchPlaceholder')"
            :aria-label="t('modelPricing.searchPlaceholder')"
          />
        </div>

        <div class="pricing-stats" aria-live="polite">
          <div>
            <strong>{{ catalogModels.length }}</strong>
            <span>{{ t('modelPricing.stats.models') }}</span>
          </div>
          <div>
            <strong>{{ platforms.length }}</strong>
            <span>{{ t('modelPricing.stats.platforms') }}</span>
          </div>
          <div>
            <strong>{{ pricedModelCount }}</strong>
            <span>{{ t('modelPricing.stats.priced') }}</span>
          </div>
        </div>
      </section>

      <section class="pricing-filters card">
        <div class="pricing-filter-block">
          <span class="pricing-filter-label">{{ t('modelPricing.filters.billing') }}</span>
          <div class="pricing-pills">
            <button
              v-for="option in billingOptions"
              :key="option.value"
              type="button"
              :class="{ active: selectedBilling === option.value }"
              @click="selectedBilling = option.value"
            >
              {{ option.label }}
              <span>{{ option.count }}</span>
            </button>
          </div>
        </div>

        <div class="pricing-filter-block">
          <span class="pricing-filter-label">{{ t('modelPricing.filters.platform') }}</span>
          <div class="pricing-pills pricing-platform-pills">
            <button
              type="button"
              :class="{ active: selectedPlatform === 'all' }"
              @click="selectedPlatform = 'all'"
            >
              {{ t('modelPricing.filters.allPlatforms') }}
              <span>{{ catalogModels.length }}</span>
            </button>
            <button
              v-for="platform in platforms"
              :key="platform.value"
              type="button"
              :class="{ active: selectedPlatform === platform.value }"
              @click="selectedPlatform = platform.value"
            >
              {{ platform.label }}
              <span>{{ platform.count }}</span>
            </button>
          </div>
        </div>
      </section>

      <div v-if="loading" class="pricing-loading card">
        <span class="spinner" />
        {{ t('modelPricing.loading') }}
      </div>

      <div v-else-if="loadFailed" class="pricing-state card">
        <Icon name="exclamationCircle" size="xl" />
        <h2>{{ t('modelPricing.loadFailed') }}</h2>
        <button type="button" class="btn btn-primary" @click="loadModels">
          <Icon name="refresh" size="sm" />
          {{ t('modelPricing.retry') }}
        </button>
      </div>

      <div v-else-if="groupedModels.length === 0" class="pricing-state card">
        <Icon name="search" size="xl" />
        <h2>{{ t('modelPricing.empty') }}</h2>
        <button type="button" class="btn btn-secondary" @click="resetFilters">
          {{ t('modelPricing.filters.reset') }}
        </button>
      </div>

      <div v-else class="space-y-4">
        <section v-for="group in groupedModels" :key="group.platform" class="pricing-group card">
          <header class="pricing-group-header">
            <div class="pricing-platform-mark">
              <ModelIcon :model="group.models[0]?.name || group.platform" size="22px" />
            </div>
            <div>
              <h2>{{ group.label }}</h2>
              <p>{{ t('modelPricing.groupCount', { count: group.models.length }) }}</p>
            </div>
            <span v-if="group.rate != null" class="pricing-rate-badge">×{{ formatRate(group.rate) }}</span>
          </header>

          <div class="pricing-table-wrap">
            <table class="pricing-table">
              <thead>
                <tr>
                  <th>{{ t('modelPricing.table.model') }}</th>
                  <th>{{ t('modelPricing.table.billing') }}</th>
                  <th>{{ t('modelPricing.table.input') }}</th>
                  <th>{{ t('modelPricing.table.output') }}</th>
                  <th>{{ t('modelPricing.table.cacheRead') }}</th>
                  <th>{{ t('modelPricing.table.cacheWrite') }}</th>
                  <th>{{ t('modelPricing.table.unitPrice') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="model in group.models" :key="modelKey(model)">
                  <td>
                    <div class="pricing-model-name">
                      <ModelIcon :model="model.name" size="20px" />
                      <div>
                        <strong>{{ model.name }}</strong>
                        <span v-if="plazaGroupCount > 1">{{ model.groupName }}</span>
                        <span v-else-if="tierRows(model).length > 1">
                          {{ t('modelPricing.tierCount', { count: tierRows(model).length }) }}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td><span class="pricing-mode-badge">{{ billingModeLabel(model) }}</span></td>
                  <template v-if="billingMode(model) === BILLING_MODE_TOKEN">
                    <td><PriceStack :model="model" :rows="tierRows(model)" field="input_price" /></td>
                    <td><PriceStack :model="model" :rows="tierRows(model)" field="output_price" /></td>
                    <td><PriceStack :model="model" :rows="tierRows(model)" field="cache_read_price" /></td>
                    <td><PriceStack :model="model" :rows="tierRows(model)" field="cache_write_price" /></td>
                    <td class="pricing-unit">{{ t('modelPricing.units.perMillion') }}</td>
                  </template>
                  <template v-else>
                    <td class="pricing-muted">—</td>
                    <td class="pricing-muted">—</td>
                    <td class="pricing-muted">—</td>
                    <td class="pricing-muted">—</td>
                    <td class="pricing-request-price">
                      <strong>{{ formatUnitPrice(model.pricing?.per_request_price ?? null) }}</strong>
                      <span>{{ requestUnit(model) }}</span>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pricing-mobile-list">
            <article v-for="model in group.models" :key="modelKey(model)" class="pricing-mobile-card">
              <header>
                <div class="pricing-model-name">
                  <ModelIcon :model="model.name" size="20px" />
                  <div>
                    <strong>{{ model.name }}</strong>
                    <span v-if="plazaGroupCount > 1">{{ model.groupName }}</span>
                  </div>
                </div>
                <span class="pricing-mode-badge">{{ billingModeLabel(model) }}</span>
              </header>
              <div v-if="billingMode(model) === BILLING_MODE_TOKEN" class="pricing-mobile-tiers">
                <section v-for="(tier, index) in tierRows(model)" :key="index" class="pricing-mobile-tier">
                  <p v-if="tierRows(model).length > 1" class="pricing-mobile-tier-label">
                    {{ tierLabel(tier) }}
                  </p>
                  <div class="pricing-mobile-metrics">
                    <div>
                      <span>{{ t('modelPricing.table.input') }}</span>
                      <span v-if="officialFieldPrice(model, 'input_price', index) != null && officialFieldPrice(model, 'input_price', index) !== tier.input_price" class="pricing-official-price">
                        {{ formatTokenPrice(officialFieldPrice(model, 'input_price', index)) }}
                      </span>
                      <strong>{{ formatTokenPrice(tier.input_price) }}</strong>
                    </div>
                    <div>
                      <span>{{ t('modelPricing.table.output') }}</span>
                      <span v-if="officialFieldPrice(model, 'output_price', index) != null && officialFieldPrice(model, 'output_price', index) !== tier.output_price" class="pricing-official-price">
                        {{ formatTokenPrice(officialFieldPrice(model, 'output_price', index)) }}
                      </span>
                      <strong>{{ formatTokenPrice(tier.output_price) }}</strong>
                    </div>
                    <div>
                      <span>{{ t('modelPricing.table.cacheRead') }}</span>
                      <span v-if="officialFieldPrice(model, 'cache_read_price', index) != null && officialFieldPrice(model, 'cache_read_price', index) !== tier.cache_read_price" class="pricing-official-price">
                        {{ formatTokenPrice(officialFieldPrice(model, 'cache_read_price', index)) }}
                      </span>
                      <strong>{{ formatTokenPrice(tier.cache_read_price) }}</strong>
                    </div>
                    <div>
                      <span>{{ t('modelPricing.table.cacheWrite') }}</span>
                      <span v-if="officialFieldPrice(model, 'cache_write_price', index) != null && officialFieldPrice(model, 'cache_write_price', index) !== tier.cache_write_price" class="pricing-official-price">
                        {{ formatTokenPrice(officialFieldPrice(model, 'cache_write_price', index)) }}
                      </span>
                      <strong>{{ formatTokenPrice(tier.cache_write_price) }}</strong>
                    </div>
                  </div>
                </section>
              </div>
              <div v-else class="pricing-mobile-request">
                <strong>{{ formatUnitPrice(model.pricing?.per_request_price ?? null) }}</strong>
                <span>{{ requestUnit(model) }}</span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import modelPlazaAPI, { type PlazaModel } from '@/api/modelPlaza'
import type { UserPricingInterval, UserSupportedModel } from '@/api/channels'
import { formatScaled, resolveIntervalPrices } from '@/utils/pricing'
import { platformLabel } from '@/utils/platformColors'
import {
  BILLING_MODE_IMAGE,
  BILLING_MODE_PER_REQUEST,
  BILLING_MODE_TOKEN,
  BILLING_MODE_VIDEO,
  type BillingMode,
} from '@/constants/channel'

interface CatalogModel extends PlazaModel {
  catalogKey: string
  groupId: number
  groupName: string
  groupRate: number
}

type BillingFilter = 'all' | BillingMode
type TokenPriceField = 'input_price' | 'output_price' | 'cache_read_price' | 'cache_write_price'

const { t } = useI18n()
const loading = ref(true)
const loadFailed = ref(false)
const sourceModels = ref<CatalogModel[]>([])
const searchQuery = ref('')
const selectedBilling = ref<BillingFilter>('all')
const selectedPlatform = ref('all')

const PriceStack = defineComponent({
  name: 'PriceStack',
  props: {
    model: { type: Object as PropType<CatalogModel>, required: true },
    rows: { type: Array as PropType<UserPricingInterval[]>, required: true },
    field: { type: String as PropType<TokenPriceField>, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'pricing-price-stack' }, props.rows.map((row, index) => {
      const official = officialFieldPrice(props.model, props.field, index)
      return h('div', { class: 'pricing-price-block' }, [
        official != null && official !== row[props.field] ? h('span', { class: 'pricing-official-price' }, formatTokenPrice(official)) : null,
        h('div', { class: 'pricing-price-line' }, [
          props.rows.length > 1 ? h('span', tierLabel(row)) : null,
          h('strong', formatTokenPrice(row[props.field])),
        ]),
      ])
    }))
  },
})

const catalogModels = computed<CatalogModel[]>(() =>
  [...sourceModels.value].sort((a, b) =>
    platformLabel(a.platform).localeCompare(platformLabel(b.platform))
    || a.name.localeCompare(b.name)
    || a.groupName.localeCompare(b.groupName),
  ),
)

const plazaGroupCount = computed(() => new Set(catalogModels.value.map((model) => model.groupId)).size)

const pricedModelCount = computed(() => catalogModels.value.filter((model) => model.pricing).length)

const platforms = computed(() => {
  const counts = new Map<string, number>()
  for (const model of catalogModels.value) {
    counts.set(model.platform, (counts.get(model.platform) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, label: platformLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const billingOptions = computed(() => [
  { value: 'all' as const, label: t('modelPricing.filters.all'), count: catalogModels.value.length },
  { value: BILLING_MODE_TOKEN, label: t('modelPricing.billing.token'), count: countBilling(BILLING_MODE_TOKEN) },
  { value: BILLING_MODE_PER_REQUEST, label: t('modelPricing.billing.request'), count: countBilling(BILLING_MODE_PER_REQUEST) },
  { value: BILLING_MODE_IMAGE, label: t('modelPricing.billing.image'), count: countBilling(BILLING_MODE_IMAGE) },
  { value: BILLING_MODE_VIDEO, label: t('modelPricing.billing.video'), count: countBilling(BILLING_MODE_VIDEO) },
].filter((option) => option.value === 'all' || option.count > 0))

const filteredModels = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  return catalogModels.value.filter((model) => {
    if (selectedBilling.value !== 'all' && billingMode(model) !== selectedBilling.value) return false
    if (selectedPlatform.value !== 'all' && model.platform !== selectedPlatform.value) return false
    return !query
      || model.name.toLocaleLowerCase().includes(query)
      || model.groupName.toLocaleLowerCase().includes(query)
      || platformLabel(model.platform).toLocaleLowerCase().includes(query)
  })
})

const groupedModels = computed(() => {
  const groups = new Map<string, { platform: string; label: string; rate: number | null; models: CatalogModel[] }>()
  for (const model of filteredModels.value) {
    const current = groups.get(model.platform) ?? {
      platform: model.platform,
      label: platformLabel(model.platform),
      rate: model.groupRate,
      models: [],
    }
    if (current.models.length > 0 && current.rate !== model.groupRate) {
      current.rate = null
    }
    current.models.push(model)
    groups.set(model.platform, current)
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))
})

function modelKey(model: Pick<CatalogModel, 'catalogKey' | 'groupId' | 'platform' | 'name'>): string {
  return model.catalogKey || `${model.groupId}:${model.platform}:${model.name}`.toLocaleLowerCase()
}

function formatRate(value: number): string {
  return trimNumber(value)
}

function resolvePlazaPlatform(model: Pick<PlazaModel, 'platform' | 'name'>): string {
  if (model.platform && model.platform !== 'composite') return model.platform
  return inferPlatformFromModelName(model.name) || model.platform || 'composite'
}

function inferPlatformFromModelName(name: string): string | null {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.startsWith('claude-') || normalized.startsWith('anthropic.claude-')) return 'anthropic'
  if (
    normalized.startsWith('gpt-')
    || normalized.startsWith('chatgpt-')
    || normalized.startsWith('codex-')
    || normalized.startsWith('o1-')
    || normalized.startsWith('o3-')
    || normalized.startsWith('o4-')
    || normalized === 'o1'
    || normalized === 'o3'
    || normalized === 'o4'
  ) return 'openai'
  if (normalized.startsWith('gemini-') || normalized.startsWith('learnlm-')) return 'gemini'
  if (normalized === 'grok' || normalized.startsWith('grok-')) return 'grok'
  if (normalized.startsWith('kimi-') || normalized.startsWith('moonshot-')) return 'kimi'
  if (normalized.startsWith('glm-')) return 'zhipu'
  if (normalized.startsWith('deepseek-')) return 'deepseek'
  if (normalized.startsWith('minimax-')) return 'minimax'
  return null
}

function billingMode(model: UserSupportedModel): BillingMode {
  return model.pricing?.billing_mode ?? BILLING_MODE_TOKEN
}

function countBilling(mode: BillingMode): number {
  return catalogModels.value.filter((model) => billingMode(model) === mode).length
}

function billingModeLabel(model: UserSupportedModel): string {
  switch (billingMode(model)) {
    case BILLING_MODE_PER_REQUEST: return t('modelPricing.billing.request')
    case BILLING_MODE_IMAGE: return t('modelPricing.billing.image')
    case BILLING_MODE_VIDEO: return t('modelPricing.billing.video')
    default: return t('modelPricing.billing.token')
  }
}

function tierRows(model: UserSupportedModel): UserPricingInterval[] {
  const pricing = model.pricing
  if (!pricing) return [emptyPriceRow()]
  if (pricing.intervals?.length) {
    return [...pricing.intervals]
      .sort((a, b) => a.min_tokens - b.min_tokens)
      .map((interval) => resolveIntervalPrices(interval, pricing))
  }
  return [{
    min_tokens: 0,
    max_tokens: null,
    input_price: pricing.input_price,
    output_price: pricing.output_price,
    cache_write_price: pricing.cache_write_price,
    cache_write_1h_price: pricing.cache_write_1h_price,
    cache_read_price: pricing.cache_read_price,
    per_request_price: pricing.per_request_price,
  }]
}

function emptyPriceRow(): UserPricingInterval {
  return {
    min_tokens: 0,
    max_tokens: null,
    input_price: null,
    output_price: null,
    cache_write_price: null,
    cache_read_price: null,
    per_request_price: null,
  }
}

function tierLabel(interval: UserPricingInterval): string {
  if (interval.tier_label) return interval.tier_label
  if (interval.max_tokens == null) return interval.min_tokens > 0 ? `>${formatTokenCount(interval.min_tokens)}` : t('modelPricing.baseTier')
  return `≤${formatTokenCount(interval.max_tokens)}`
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${trimNumber(value / 1_000_000)}M`
  if (value >= 1_000) return `${trimNumber(value / 1_000)}K`
  return String(value)
}

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function formatTokenPrice(value: number | null): string {
  return formatScaled(value, 1_000_000, 2)
}

function officialFieldPrice(model: CatalogModel, field: TokenPriceField, index = 0): number | null {
  const official = model.official_pricing
  if (!official) return null
  if (official.intervals?.length) {
    const interval = [...official.intervals]
      .sort((a, b) => a.min_tokens - b.min_tokens)[Math.min(index, official.intervals.length - 1)]
    return resolveIntervalPrices(interval, official)[field] ?? null
  }
  return official[field] ?? null
}

function formatUnitPrice(value: number | null): string {
  return formatScaled(value, 1, 2)
}


function requestUnit(model: UserSupportedModel): string {
  switch (billingMode(model)) {
    case BILLING_MODE_IMAGE: return t('modelPricing.units.perImage')
    case BILLING_MODE_VIDEO: return t('modelPricing.units.perVideo')
    default: return t('modelPricing.units.perRequest')
  }
}

function resetFilters() {
  searchQuery.value = ''
  selectedBilling.value = 'all'
  selectedPlatform.value = 'all'
}

async function loadModels() {
  loading.value = true
  loadFailed.value = false
  try {
    const plaza = await modelPlazaAPI.getModelPlaza()
    sourceModels.value = (plaza.groups ?? []).flatMap((group) => {
      const groupRate = group.user_rate_multiplier ?? group.rate_multiplier
      return group.models.map((model) => {
        const platform = resolvePlazaPlatform(model)
        return {
          ...model,
          platform,
          catalogKey: `${group.id}:${platform}:${model.name}`.toLocaleLowerCase(),
          groupId: group.id,
          groupName: group.name,
          groupRate,
        }
      })
    })
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadModels)
</script>

<style scoped>
.pricing-page { padding-bottom: 28px; }
.pricing-toolbar { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:14px !important; }
.pricing-search { display:flex; width:100%; height:36px; min-width:0; max-width:520px; flex:1; align-items:center; gap:9px; padding:0 12px; border:1px solid #1d2d52; border-radius:8px; background:#091532; color:#7180a7; }
.pricing-search:focus-within { border-color:rgba(217,70,239,.55); box-shadow:0 0 0 3px rgba(217,70,239,.08); }
.pricing-search input { width:100%; height:100%; border:0 !important; padding:0 !important; background:transparent !important; color:#fff; outline:0 !important; box-shadow:none !important; }
.pricing-stats { display:grid; grid-template-columns:repeat(3,minmax(82px,1fr)); overflow:hidden; border:1px solid rgba(100,126,204,.16); border-radius:8px; background:rgba(7,15,39,.65); }
.pricing-stats div { display:grid; align-content:center; min-width:92px; padding:7px 14px; text-align:center; }
.pricing-stats div+div { border-left:1px solid rgba(100,126,204,.16); }
.pricing-stats strong { color:#fff; font-size:18px; }
.pricing-stats span { color:#697596; font-size:10px; text-transform:uppercase; }
.pricing-filters { display:grid; gap:16px; padding:18px !important; }
.pricing-filter-block { display:grid; grid-template-columns:100px minmax(0,1fr); align-items:start; gap:14px; }
.pricing-filter-label { padding-top:8px; color:#657190; font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
.pricing-pills { display:flex; flex-wrap:wrap; gap:7px; }
.pricing-pills button { display:inline-flex; align-items:center; gap:7px; min-height:34px; padding:0 11px; border:1px solid rgba(103,125,190,.18); border-radius:6px; background:#09142f; color:#98a4c4; font-size:12px; transition:150ms ease; }
.pricing-pills button:hover { border-color:rgba(217,70,239,.28); color:#fff; }
.pricing-pills button.active { border-color:rgba(217,70,239,.38); background:#23133d; color:#f5d0fe; box-shadow:inset 2px 0 #d946ef; }
.pricing-pills button span { color:#657190; font-size:10px; }
.pricing-pills button.active span { color:#d8b4fe; }
.pricing-loading,.pricing-state { display:flex; min-height:220px; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:#7e8aaa; }
.pricing-state h2 { color:#dce2f4; font-size:16px; }
.spinner { width:28px; height:28px; border:2px solid #253154; border-top-color:#d946ef; border-radius:50%; animation:pricing-spin .8s linear infinite; }
@keyframes pricing-spin { to { transform:rotate(360deg); } }
.pricing-group { overflow:hidden; }
.pricing-group-header { display:flex; align-items:center; gap:12px; min-height:70px; padding:12px 18px; border-bottom:1px solid rgba(100,126,204,.15); background:linear-gradient(90deg,rgba(217,70,239,.07),transparent 42%); }
.pricing-platform-mark { display:flex; width:40px; height:40px; align-items:center; justify-content:center; border:1px solid rgba(217,70,239,.2); border-radius:9px; background:#0a1634; }
.pricing-group-header h2 { color:#fff; font-size:16px; font-weight:700; }
.pricing-group-header p { margin-top:2px; color:#697596; font-size:11px; }
.pricing-rate-badge { margin-left:auto; padding:5px 9px; border:1px solid rgba(217,70,239,.24); border-radius:5px; background:#211338; color:#f0abfc; font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px; font-weight:700; }
.pricing-table-wrap { overflow-x:auto; }
.pricing-table { width:100%; min-width:1050px; border-collapse:collapse; font-size:12px; }
.pricing-table th { padding:11px 14px; background:#08132e; color:#617091; font-size:10px; font-weight:800; letter-spacing:.09em; text-align:left; text-transform:uppercase; }
.pricing-table td { padding:13px 14px; border-top:1px solid rgba(91,112,177,.12); color:#c8d1e8; vertical-align:middle; }
.pricing-table tbody tr:hover td { background:rgba(109,93,252,.045); }
.pricing-model-name { display:flex; min-width:210px; align-items:center; gap:10px; }
.pricing-model-name strong { display:block; color:#f4f6ff; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; font-weight:650; }
.pricing-model-name span { display:block; margin-top:3px; color:#606d8c; font-size:10px; }
.pricing-mode-badge { display:inline-flex; padding:4px 7px; border:1px solid rgba(97,122,193,.18); border-radius:5px; background:#0a1633; color:#91a0c5; font-size:10px; white-space:nowrap; }
.pricing-price-stack { display:grid; gap:4px; }
.pricing-price-block { display:grid; gap:2px; }
:deep(.pricing-official-price) {
  color: #9aa3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  text-decoration-line: line-through;
  text-decoration-thickness: 1px;
  text-decoration-color: currentColor;
}
.pricing-price-line { display:flex; align-items:center; gap:6px; white-space:nowrap; }
.pricing-price-line span { min-width:38px; color:#657190; font-family:ui-sans-serif,system-ui,sans-serif; font-size:9px; }
.pricing-price-line strong,.pricing-request-price strong { color:#f0abfc; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; font-weight:700; }
.pricing-unit,.pricing-muted { color:#566281 !important; }
.pricing-request-price span { display:block; margin-top:3px; color:#687494; font-size:9px; }
.pricing-mobile-list { display:none; }

:global(html:not(.dark) .pricing-search) {
  border-color: #dfe4ef;
  background: #f7f9fd;
  color: #718096;
}
:global(html:not(.dark) .pricing-search input) { color:#172033; }
:global(html:not(.dark) .pricing-stats) {
  border-color:#e0e5ef;
  background:#f8faff;
}
:global(html:not(.dark) .pricing-stats div+div) { border-color:#e0e5ef; }
:global(html:not(.dark) .pricing-stats strong),
:global(html:not(.dark) .pricing-group-header h2),
:global(html:not(.dark) .pricing-model-name strong) { color:#172033; }
:global(html:not(.dark) .pricing-stats span),
:global(html:not(.dark) .pricing-filter-label),
:global(html:not(.dark) .pricing-group-header p),
:global(html:not(.dark) .pricing-model-name span) { color:#718096; }
:global(html:not(.dark) .pricing-pills button) {
  border-color:#dfe4ef;
  background:#f8faff;
  color:#52617a;
}
:global(html:not(.dark) .pricing-pills button:hover) { border-color:rgba(124,58,237,.3); color:#172033; }
:global(html:not(.dark) .pricing-pills button.active) {
  border-color:rgba(124,58,237,.28);
  background:#eeeafe;
  color:#6d28d9;
  box-shadow:inset 2px 0 #7c3aed;
}
:global(html:not(.dark) .pricing-pills button.active span) { color:#8b5cf6; }
:global(html:not(.dark) .pricing-group-header) {
  border-color:#e0e5ef;
  background:linear-gradient(90deg,rgba(124,58,237,.055),transparent 42%);
}
:global(html:not(.dark) .pricing-platform-mark) {
  border-color:rgba(124,58,237,.16);
  background:#f5f3ff;
}
:global(html:not(.dark) .pricing-rate-badge) {
  border-color:rgba(124,58,237,.2);
  background:#f3e8ff;
  color:#7e22ce;
}
:global(html:not(.dark) .pricing-table th) {
  background:#f6f8fc;
  color:#667085;
}
:global(html:not(.dark) .pricing-table td) {
  border-color:#e6eaf1;
  color:#344054;
}
:global(html:not(.dark) .pricing-table tbody tr:hover td) { background:#faf9ff; }
:global(html:not(.dark) .pricing-mode-badge) {
  border-color:#dfe4ef;
  background:#f5f7fb;
  color:#52617a;
}
:global(html:not(.dark) .pricing-price-line strong),
:global(html:not(.dark) .pricing-request-price strong) { color:#7c3aed; }
:global(html:not(.dark) .pricing-official-price) { color:#98a2b3; }
@media (max-width: 900px) {
  .pricing-toolbar { flex-direction:column; align-items:stretch; }
  .pricing-search { max-width:none; }
  .pricing-filter-block { grid-template-columns:1fr; gap:7px; }
}
@media (max-width: 640px) {
  .pricing-stats div { min-width:0; padding:8px 5px; }
  .pricing-platform-pills { flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; }
  .pricing-platform-pills button { flex:0 0 auto; }
  .pricing-table-wrap { display:none; }
  .pricing-mobile-list { display:grid; gap:10px; padding:12px; }
  .pricing-mobile-card { padding:13px; border:1px solid rgba(100,126,204,.14); border-radius:8px; background:#08132e; }
  .pricing-mobile-card>header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
  .pricing-model-name { min-width:0; }
  .pricing-mobile-tiers { display:grid; gap:10px; margin-top:12px; }
  .pricing-mobile-tier+.pricing-mobile-tier { padding-top:10px; border-top:1px solid rgba(100,126,204,.13); }
  .pricing-mobile-tier-label { margin-bottom:7px; color:#8390b2; font-size:10px; font-weight:700; }
  .pricing-mobile-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .pricing-mobile-metrics div { display:grid; gap:2px; padding:9px; border-radius:6px; background:#0b1735; }
  .pricing-mobile-metrics span { color:#657190; font-size:9px; text-transform:uppercase; }
  .pricing-mobile-metrics .pricing-official-price {
    color: #9aa3b8;
    font-size: 11px;
    font-weight: 500;
    text-transform: none;
  }
  .pricing-mobile-metrics strong,.pricing-mobile-request strong { color:#f0abfc; font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px; }
  .pricing-mobile-request { display:flex; align-items:baseline; gap:7px; margin-top:14px; }
  .pricing-mobile-request span { color:#657190; font-size:10px; }
}
@media (max-width: 640px) {
  :global(html:not(.dark) .pricing-mobile-card) {
    border-color:#e0e5ef;
    background:#ffffff;
  }
  :global(html:not(.dark) .pricing-mobile-tier+.pricing-mobile-tier) { border-color:#e6eaf1; }
  :global(html:not(.dark) .pricing-mobile-metrics div) { background:#f6f8fc; }
  :global(html:not(.dark) .pricing-mobile-metrics strong),
  :global(html:not(.dark) .pricing-mobile-request strong) { color:#7c3aed; }
}
</style>


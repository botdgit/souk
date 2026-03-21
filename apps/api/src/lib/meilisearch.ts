import { MeiliSearch } from 'meilisearch'

function getMeiliConfig() {
  const host = process.env.MEILISEARCH_HOST
  const apiKey = process.env.MEILISEARCH_API_KEY

  if (!host) {
    console.warn('MEILISEARCH_HOST not set, using localhost fallback')
  }

  return { host: host || 'http://localhost:7700', apiKey }
}

const config = getMeiliConfig()

export const meili = new MeiliSearch({
  host: config.host,
  apiKey: config.apiKey,
})

export const LISTINGS_INDEX = 'listings'

export async function initMeilisearch() {
  const index = meili.index(LISTINGS_INDEX)

  await index.updateSettings({
    searchableAttributes: [
      'title',
      'brand',
      'category',
      'description',
      'area',
      'sellerDisplayName',
    ],
    filterableAttributes: [
      'category',
      'area',
      'size',
      'condition',
      'priceAed',
      'status',
      'sellerVerified',
    ],
    sortableAttributes: ['priceAed', 'createdAt'],
    rankingRules: [
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
      'sellerVerified:desc',
    ],
  })
}

export async function indexListing(listing: Record<string, unknown>) {
  const index = meili.index(LISTINGS_INDEX)
  await index.addDocuments([listing])
}

export async function removeListing(id: string) {
  const index = meili.index(LISTINGS_INDEX)
  await index.deleteDocument(id)
}

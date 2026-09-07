const openapiUrl = process.env.EDUFURTHER_OPENAPI_URL ?? 'http://127.0.0.1:8000/openapi.json'

const response = await fetch(openapiUrl)
if (!response.ok) throw new Error(`Unable to fetch backend OpenAPI schema: HTTP ${response.status}`)
const document = await response.json()
const search = document.paths?.['/api/v1/search']?.post
const taxonomies = document.paths?.['/api/v1/taxonomies']?.get
if (!search || !taxonomies) throw new Error('Backend OpenAPI is missing the required search or taxonomies endpoint.')

const schemas = document.components?.schemas ?? {}
const searchSchema = schemas.SearchResponse?.properties?.data?.items?.$ref
  ? schemas[schemas.SearchResponse.properties.data.items.$ref.split('/').pop()]
  : null
const taxonomySchema = schemas.TaxonomiesResponse?.properties ?? {}
const requiredSearchFields = ['destinations', 'deadline_at', 'deadline_precision', 'degree_levels', 'expected_reopen_month', 'funding_type', 'provider_country']
const missingSearchFields = requiredSearchFields.filter((field) => !searchSchema?.properties?.[field])
const requiredTaxonomyFields = ['countries', 'destinations', 'degrees', 'fields', 'award_types', 'funding_types']
const missingTaxonomyFields = requiredTaxonomyFields.filter((field) => !taxonomySchema[field])
if (missingSearchFields.length || missingTaxonomyFields.length) {
  throw new Error(JSON.stringify({ missingSearchFields, missingTaxonomyFields }))
}
console.log(`Backend contract OK: ${openapiUrl}`)

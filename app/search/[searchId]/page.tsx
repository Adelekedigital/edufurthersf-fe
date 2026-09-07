import { Finder } from '../../finder'

type SearchPageProps = {
  params: Promise<{ searchId: string }>
  searchParams: Promise<{ scholarship?: string }>
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { searchId } = await params
  const { scholarship } = await searchParams
  return <Finder searchId={searchId} selectedScholarshipId={scholarship} />
}
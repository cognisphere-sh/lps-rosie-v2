type SearchRow = { values: Record<string, unknown> }

type SearchGroup<T extends SearchRow> = {
  plants: T[]
}

function words(value: unknown): string[] {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? []
}

function sameWordOrPrefix(queryWord: string, documentWord: string): boolean {
  if (queryWord === documentWord) return true
  if (queryWord.length < 3 || documentWord.length < 3) return false
  return queryWord.startsWith(documentWord) || documentWord.startsWith(queryWord)
}

/**
 * The RPC intentionally casts a wide fuzzy/alias net. For a multi-word plant
 * identity, prefer rows whose own name/aliases contain every requested word;
 * this prevents `Agave Americana` from inheriting every other `americana`.
 * If refinement finds nothing, retain the RPC set so typo/fuzzy searches work.
 */
export function refinePlantGroups<T extends SearchRow, G extends SearchGroup<T>>(
  groups: G[],
  query: string,
): G[] {
  const queryWords = words(query)
  if (queryWords.length < 2) return groups

  let matches = 0
  const refined = groups.map((group) => {
    const plants = group.plants.filter((plant) => {
      const documentWords = words(`${plant.values.name ?? ''} ${plant.values.other ?? ''}`)
      const match = queryWords.every((needle) =>
        documentWords.some((word) => sameWordOrPrefix(needle, word)),
      )
      if (match) matches += 1
      return match
    })
    return { ...group, plants }
  }).filter((group) => group.plants.length > 0) as G[]

  return matches > 0 ? refined : groups
}

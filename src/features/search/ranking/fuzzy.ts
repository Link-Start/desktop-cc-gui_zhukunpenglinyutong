const NO_FUZZY_MATCH = null;

export type FuzzyMatchScore = number | typeof NO_FUZZY_MATCH;

/** 越小越相关；null 表示不匹配。 */
export function scoreFuzzyMatch(query: string, candidate: string): FuzzyMatchScore {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const normalizedCandidate = candidate.toLocaleLowerCase();
  if (!normalizedQuery) {
    return 0;
  }
  if (!normalizedCandidate) {
    return NO_FUZZY_MATCH;
  }
  if (normalizedCandidate === normalizedQuery) {
    return 0;
  }
  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 10 + Math.min(normalizedCandidate.length - normalizedQuery.length, 20);
  }

  const substringIndex = normalizedCandidate.indexOf(normalizedQuery);
  if (substringIndex >= 0) {
    return 40 + substringIndex + Math.min(normalizedCandidate.length - normalizedQuery.length, 20);
  }

  let queryIndex = 0;
  let firstMatchIndex = -1;
  let previousMatchIndex = -1;
  let totalGap = 0;
  for (let candidateIndex = 0; candidateIndex < normalizedCandidate.length; candidateIndex += 1) {
    if (normalizedQuery[queryIndex] !== normalizedCandidate[candidateIndex]) {
      continue;
    }
    if (firstMatchIndex < 0) {
      firstMatchIndex = candidateIndex;
    } else {
      totalGap += candidateIndex - previousMatchIndex - 1;
    }
    previousMatchIndex = candidateIndex;
    queryIndex += 1;
    if (queryIndex === normalizedQuery.length) {
      return 100 + firstMatchIndex + totalGap * 3 + Math.min(normalizedCandidate.length, 40);
    }
  }

  return NO_FUZZY_MATCH;
}

export function bestFuzzyMatchScore(query: string, candidates: string[]): FuzzyMatchScore {
  let bestScore: number | null = null;
  for (const candidate of candidates) {
    const score = scoreFuzzyMatch(query, candidate);
    if (score !== null && (bestScore === null || score < bestScore)) {
      bestScore = score;
    }
  }
  return bestScore;
}

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Voter {
  id: number
  bil: number
  no_kp: string
  no_kp_id_lain?: string
  jantina: 'L' | 'P'
  tahun_lahir: number
  nama_pemilih: string
  kod_daerah_mengundi: string
  daerah_mengundi: string
  kod_lokaliti: string
  lokaliti: string
  dun?: string
  tag?: 'Yes' | 'Unsure' | 'No' | null
  created_at?: string
  updated_at?: string
}

export interface VoterFilters {
  nameSearch?: string
  gender?: 'L' | 'P' | ''
  ageGroup?: '18-30' | '30-40' | '40-55' | '55+' | ''
  specificAge?: number
  dun?: string[]
  daerah?: string[]
  lokaliti?: string[]
  tag?: 'Yes' | 'Unsure' | 'No' | 'untagged' | ''
}

export const calculateAge = (birthYear: number): number => {
  const currentYear = new Date().getFullYear()
  return currentYear - birthYear
}

function getAuthHeader(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

export const fetchVoters = async (filters: VoterFilters = {}) => {
  const params = new URLSearchParams()

  if (filters.nameSearch) params.append('name', filters.nameSearch)
  if (filters.gender) params.append('gender', filters.gender)
  if (filters.daerah && filters.daerah.length > 0) {
    filters.daerah.forEach((d) => params.append('daerah', d))
  }
  if (filters.lokaliti && filters.lokaliti.length > 0) {
    filters.lokaliti.forEach((l) => params.append('lokaliti', l))
  }
  if (filters.tag && filters.tag !== 'untagged') {
    params.append('tag', filters.tag)
  } else if (filters.tag === 'untagged') {
    params.append('tag', 'untagged')
  }

  const response = await fetch(`${API_BASE_URL}/api/voters?${params.toString()}`, {
    headers: getAuthHeader(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch voters')
  }

  const data = await response.json()
  return data.data as Voter[]
}

// OPTIMIZED: Single voter update with optimistic UI support
export const updateVoterTag = async (voterId: number, tag: 'Yes' | 'Unsure' | 'No' | null) => {
  const response = await fetch(`${API_BASE_URL}/api/voters/${voterId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ tag }),
  })

  if (!response.ok) {
    throw new Error('Failed to update voter tag')
  }

  const data = await response.json()
  return data
}

// NEW: Batch update multiple voters at once
export interface BatchUpdate {
  voter_id: number
  tag: 'Yes' | 'Unsure' | 'No' | null
}

export const batchUpdateVoterTags = async (updates: BatchUpdate[]) => {
  const response = await fetch(`${API_BASE_URL}/api/voters/batch-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ updates }),
  })

  if (!response.ok) {
    throw new Error('Failed to batch update voters')
  }

  const data = await response.json()
  return data
}

// NEW: Queue for pending updates (client-side only)
class UpdateQueue {
  private queue: Map<number, 'Yes' | 'Unsure' | 'No' | null> = new Map()
  private timer: NodeJS.Timeout | null = null
  private readonly BATCH_DELAY = 2000 // 2 seconds

  add(voterId: number, tag: 'Yes' | 'Unsure' | 'No' | null) {
    this.queue.set(voterId, tag)
    
    // Clear existing timer
    if (this.timer) {
      clearTimeout(this.timer)
    }

    // Set new timer to flush after delay
    this.timer = setTimeout(() => {
      this.flush()
    }, this.BATCH_DELAY)
  }

  async flush() {
    if (this.queue.size === 0) return

    const updates: BatchUpdate[] = Array.from(this.queue.entries()).map(
      ([voter_id, tag]) => ({ voter_id, tag })
    )

    this.queue.clear()

    try {
      await batchUpdateVoterTags(updates)
      console.log(`✅ Synced ${updates.length} updates to server`)
    } catch (error) {
      console.error('❌ Failed to sync updates:', error)
      // Re-queue failed updates
      updates.forEach((update) => {
        this.queue.set(update.voter_id, update.tag)
      })
    }
  }

  getPendingCount() {
    return this.queue.size
  }

  hasPending(voterId: number) {
    return this.queue.has(voterId)
  }

  getPendingTag(voterId: number) {
    return this.queue.get(voterId)
  }
}

// Export singleton instance
export const updateQueue = new UpdateQueue()

export const getUniqueValues = async (column: 'daerah_mengundi' | 'lokaliti' | 'dun'): Promise<string[]> => {
  let endpoint = ''
  switch (column) {
    case 'daerah_mengundi':
      endpoint = '/api/daerah'
      break
    case 'lokaliti':
      endpoint = '/api/lokaliti'
      break
    case 'dun':
      endpoint = '/api/dun-list'
      break
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: getAuthHeader(),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${column}`)
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export const getStatistics = async () => {
  const response = await fetch(`${API_BASE_URL}/api/stats`, {
    headers: getAuthHeader(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch statistics')
  }

  return await response.json()
}

export const getLokalitiByDaerah = async (daerahs: string[]) => {
  if (!daerahs || daerahs.length === 0) {
    return getUniqueValues('lokaliti')
  }

  return getUniqueValues('lokaliti')
}
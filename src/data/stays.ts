import { supabase } from '../lib/supabase'
import type { Apartment } from '../types'
import type { StayInput, StayWithApartment } from '../types'

export type StayFilters = {
  year?: number
  apartmentId?: number
}

const staySelect =
  'id, guest_name, guest_phone, guest_email, guest_address, apartment_id, people_count, nights_count, linen, rating, notes, check_in, check_out, year, created_at, apartment:apartments(id, name)'

type RawStayWithApartment = Omit<StayWithApartment, 'apartment'> & {
  apartment?: Apartment | Apartment[] | null
}

function normalizeApartment(
  apartment: RawStayWithApartment['apartment'],
): Apartment | null | undefined {
  if (Array.isArray(apartment)) {
    return apartment[0] ?? null
  }
  return apartment
}

function normalizeStay(row: RawStayWithApartment): StayWithApartment {
  return {
    ...row,
    apartment: normalizeApartment(row.apartment),
  }
}

export async function listStays(
  filters: StayFilters,
): Promise<StayWithApartment[]> {
  let query = supabase.from('stays').select(staySelect).order('created_at', {
    ascending: false,
  })

  if (filters.year) {
    query = query.eq('year', filters.year)
  }

  if (filters.apartmentId) {
    query = query.eq('apartment_id', filters.apartmentId)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const rows = (data ?? []) as RawStayWithApartment[]
  return rows.map(normalizeStay)
}

export async function createStay(payload: StayInput): Promise<StayWithApartment> {
  const { data, error } = await supabase
    .from('stays')
    .insert([payload])
    .select(staySelect)
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Não foi possível criar o registo.')
  }

  return normalizeStay(data as RawStayWithApartment)
}

export async function updateStay(
  id: number,
  payload: Partial<StayInput>,
): Promise<StayWithApartment> {
  const { data, error } = await supabase
    .from('stays')
    .update(payload)
    .eq('id', id)
    .select(staySelect)
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Não foi possível atualizar o registo.')
  }

  return normalizeStay(data as RawStayWithApartment)
}

export async function deleteStay(id: number): Promise<void> {
  const { error } = await supabase.from('stays').delete().eq('id', id)

  if (error) {
    throw error
  }
}

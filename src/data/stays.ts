import { supabase } from '../lib/supabase'
import type { StayInput, StayWithApartment } from '../types'

export type StayFilters = {
  year?: number
  apartmentId?: number
}

const staySelect =
  'id, guest_name, guest_phone, guest_email, guest_address, apartment_id, people_count, nights_count, linen, rating, notes, year, created_at, apartment:apartments(id, name)'

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

  return data ?? []
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

  return data
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

  return data
}

export async function deleteStay(id: number): Promise<void> {
  const { error } = await supabase.from('stays').delete().eq('id', id)

  if (error) {
    throw error
  }
}

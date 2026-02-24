import { supabase } from '../lib/supabase'
import type { Apartment } from '../types'

export async function listApartments(): Promise<Apartment[]> {
  const { data, error } = await supabase
    .from('apartments')
    .select('id, name')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function createApartment(name: string): Promise<Apartment> {
  const { data, error } = await supabase
    .from('apartments')
    .insert([{ name }])
    .select('id, name')
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Não foi possível criar o apartamento.')
  }

  return data
}

export async function deleteApartment(id: number): Promise<void> {
  const { error } = await supabase.from('apartments').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export type Apartment = {
  id: number
  name: string
  created_at?: string | null
}

export type Stay = {
  id: number
  guest_name: string
  guest_phone: string
  guest_email: string
  guest_address: string
  apartment_id: number
  people_count: number
  nights_count: number
  linen: string | null
  rating: number | null
  notes: string | null
  year: number
  created_at?: string | null
}

export type StayInput = Omit<Stay, 'id' | 'created_at'>

export type StayWithApartment = Stay & { apartment?: Apartment | null }

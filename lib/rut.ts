// lib/rut.ts
// Utilidades para validar y formatear RUT chileno

/**
 * Limpia un RUT dejando solo dígitos y K/k (sin puntos ni guión).
 */
export function cleanRut(rut: string): string {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase()
}

/**
 * Formatea un RUT como 76.123.456-7
 */
export function formatRut(rut: string): string {
  const c = cleanRut(rut)
  if (c.length < 2) return c
  const cuerpo = c.slice(0, -1)
  const dv     = c.slice(-1)
  // Agrupar de a 3 desde la derecha
  const cuerpoFormat = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpoFormat}-${dv}`
}

/**
 * Calcula el dígito verificador correcto de un cuerpo numérico de RUT.
 */
function calcDv(cuerpo: string): string {
  let suma = 0
  let mul  = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return resto.toString()
}

/**
 * Valida un RUT chileno. Acepta con o sin puntos/guión.
 * Devuelve true si es válido.
 */
export function isValidRut(rut: string): boolean {
  const c = cleanRut(rut)
  if (c.length < 8 || c.length > 9) return false
  const cuerpo = c.slice(0, -1)
  const dv     = c.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  return calcDv(cuerpo) === dv
}

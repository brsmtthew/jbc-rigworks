export const COMPANY_ADMIN_EMAIL = 'jbcrigworks@gmail.com'

export function isCompanyAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === COMPANY_ADMIN_EMAIL
}

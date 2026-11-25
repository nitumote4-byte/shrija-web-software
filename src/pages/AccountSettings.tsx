import { CompanyProfile } from './OthersPages'

/** Centre account: firm name, GST, bank, and outlets. Not the user list. */
export function AccountSettingsPage() {
  return (
    <CompanyProfile
      backTo="/"
      backLabel="Back to Dashboard"
      heading="Account Settings"
    />
  )
}

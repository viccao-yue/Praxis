/** Sidebar account launcher and locally authoritative sign-out action. */
import { useState } from 'react'
import { Menu, IconSettingsOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AccountSectionInjected } from './AccountSection.tsx'
import { SignInDialog } from './SignInDialog.tsx'
import { LogoutIcon } from './LogoutIcon.tsx'
import { AccountAvatar } from './AccountAvatar.tsx'
import css from './AccountMenu.module.css'

/** Account launcher composed by the settings shell. */
export type AccountMenuProps = PropsRuntime<'settings.launcher'> & PropsLocale<'settings.account'> & InjectFace<AccountSectionInjected>

/** The signed-in label stays empty while the profile loads.
 * @param props - sidebar geometry, settings navigation and account operations.
 * @returns account menu launcher.
 */
export function AccountMenu({
  wide, openSettings, openOnboarding, useAccount, signOut, showLogin, start, cancel, t,
}: AccountMenuProps) {
  const account = useAccount(state => state)
  const signedIn = account.view?.status === 'credential-stored'
  const profile = account.details?.profile
  const label = profile === undefined ? null : profile.status === 'ready'
    ? profile.value.name ?? profile.value.contact ?? t('signedIn') : t('signedIn')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const logout = async () => {
    setBusy(true)
    setLogoutFailed(false)
    try { await signOut(); setOpen(false) }
    catch { setLogoutFailed(true) }
    finally { setBusy(false) }
  }
  return <div className={css.root}>
    <Menu open={open} side="top" portal autoFocus className={css.anchor}
      anchor={<button type="button" className={css.trigger} data-collapsed={!wide} aria-label={t('menu')}
        aria-haspopup="menu" aria-expanded={open} onClick={() => { if (signedIn) setOpen(value => !value); else openSettings() }}>
        <span className={css.avatar}><AccountAvatar url={signedIn && profile?.status === 'ready' ? profile.value.avatarUrl : null} /></span>
        {wide && <span className={css.label}>{signedIn ? label : t('settings')}</span>}
      </button>}
      items={[
        { id: 'settings', label: t('settings'), icon: <IconSettingsOutlineMedium size={16} /> },
        ...(signedIn ? [{ id: 'signout', label: t('signOut'), icon: <LogoutIcon />, disabled: busy }] : []),
      ]}
      onClose={() => { setOpen(false) }}
      onSelect={(id) => {
        if (id === 'settings') { setOpen(false); openSettings() }
        else void logout()
      }} />
    {account.loginVisible && !account.onboarding && <SignInDialog account={account} start={start} cancel={cancel} t={t}
      close={() => { showLogin(false) }} useApiKey={() => { showLogin(false); openOnboarding('deepseek-official') }} />}
    {logoutFailed && <span className={css.error} role="alert">{t('failed')}</span>}
  </div>
}

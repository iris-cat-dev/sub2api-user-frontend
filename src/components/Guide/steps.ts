import type { DriveStep } from 'driver.js'

export function getUserSteps(t: (key: string) => string): DriveStep[] {
  return [
    {
      popover: {
        title: t('onboarding.user.welcome.title'),
        description: t('onboarding.user.welcome.description'),
        align: 'center',
        nextBtnText: t('onboarding.user.welcome.nextBtn'),
        prevBtnText: t('onboarding.user.welcome.prevBtn'),
      },
    },
    {
      element: '[data-tour="sidebar-my-keys"]',
      popover: {
        title: t('onboarding.user.keyManage.title'),
        description: t('onboarding.user.keyManage.description'),
        side: 'right',
        align: 'center',
        showButtons: ['close'],
      },
    },
    {
      element: '[data-tour="keys-create-btn"]',
      popover: {
        title: t('onboarding.user.createKey.title'),
        description: t('onboarding.user.createKey.description'),
        side: 'bottom',
        align: 'end',
        showButtons: ['close'],
      },
    },
    {
      element: '[data-tour="key-form-name"]',
      popover: {
        title: t('onboarding.user.keyName.title'),
        description: t('onboarding.user.keyName.description'),
        side: 'right',
        align: 'start',
        showButtons: ['next', 'previous'],
      },
    },
    {
      element: '[data-tour="key-form-group"]',
      popover: {
        title: t('onboarding.user.keyGroup.title'),
        description: t('onboarding.user.keyGroup.description'),
        side: 'right',
        align: 'start',
        showButtons: ['next', 'previous'],
      },
    },
    {
      element: '[data-tour="key-form-submit"]',
      popover: {
        title: t('onboarding.user.keySubmit.title'),
        description: t('onboarding.user.keySubmit.description'),
        side: 'left',
        align: 'center',
        showButtons: ['close'],
      },
    },
  ]
}

// drift detection thresholds
export const TABS_THRESHOLD = 4;
export const TIME_WINDOW = 90000;      // 90 seconds
export const IDLE_TIMEOUT = 600000;    // 10 minutes
export const INTERRUPT_COOLDOWN = 300000; // 5 minutes

// localStorage keys
export const KEYS = {
  ACTIVE_SESSION: 'drift_active_session',
  INTENTION:      'drift_intention',
  START_TIME:     'drift_start_time',
  SESSION_END:    'drift_session_end',
  RECENT:         'drift_recent_intentions',
  ONBOARDED:      'drift_onboarded',
  SETTINGS:       'drift_settings',
  TAB_OPENS:      'drift_tab_opens',
};
/**
 * Imperial stronghold content copy (v1.80 system layer)
 *
 * Prefix content.imperialStrongholds.*: stronghold names / descriptions /
 * inspection fleet. Separate from the archive domain content.imperial.*.
 */
export default {
  'content.imperialStrongholds.imp_pass.name': 'Tribute Gate',
  'content.imperialStrongholds.imp_pass.desc':
    'An old checkpoint at the throat of the tribute route, its verification lamps sweeping every passing convoy.',
  'content.imperialStrongholds.imp_audit.name': 'Audit Platform',
  'content.imperialStrongholds.imp_audit.desc':
    'A verification platform beside the Arm Spine lane, where every tribute ship surrenders its route and manifest.',
  'content.imperialStrongholds.imp_guard.name': 'Guard Dock',
  'content.imperialStrongholds.imp_guard.desc':
    'A ceremonial guard dock outside the Cradle Cluster, where the Imperial Court rotates its honor fleet.',
  'content.imperialStrongholds.imp_verdict.name': 'Verdict Harbor',
  'content.imperialStrongholds.imp_verdict.desc':
    "A verdict harbor deep in the Stardust Range, where the adjudication fleet musters to collect the courts' tribute.",
  'content.imperialStrongholds.imp_echo.name': 'Furnace Echo Terrace',
  'content.imperialStrongholds.imp_echo.desc':
    'A listening terrace beside the silent halo, recording the low pulse of the galactic core as a single thin line.',
  'content.imperialStrongholds.imp_court.name': 'Furnace Forecourt',
  'content.imperialStrongholds.imp_court.desc':
    'The forecourt at the rim of the Silver Disk Hub, where the tribute route passes the last gate before the furnace.',
  'content.imperialStrongholds.audit.name': 'Imperial Inspection Fleet',
  'content.imperialStrongholds.audit.desc':
    'An adjudication squadron that tours the tribute nodes each week; a failed inspection reclaims the stronghold.',

  // The furnace domain (v1.83): tribute feeding and fire stability;
  // inputs are four of five resources (data excluded), yield is data
  'content.imperialStrongholds.forge.name': 'The Furnace Domain',
  'content.imperialStrongholds.forge.desc':
    'The domain at the end of the tribute route. Feed the furnace to steady the fire; the higher the stability, the richer the return. Each week the furnace names one tribute — named tribute returns thrice.',
  'content.imperialStrongholds.forge.stabilityLabel': 'Fire Stability',
  'content.imperialStrongholds.forge.stabilityDesc':
    'Stability decays over time and refills with each tribute; returns come in three tiers above 80/50/20, none below 20.',
  'content.imperialStrongholds.forge.remaining': 'Tributes left today: {n}',
  'content.imperialStrongholds.forge.enter': 'Enter the Furnace Domain',
  'content.imperialStrongholds.forge.tributeHint': 'Give a fixed amount to refill the fire by +24',
  'content.imperialStrongholds.forge.yieldDesc':
    'Returns scale with stability tiers above 80/50/20, named tribute ×3, none below 20; 4 per day.',
  'content.imperialStrongholds.forge.tribute': 'Give Tribute',
  'content.imperialStrongholds.forge.pickHint': 'Named this week: {res} (return ×3)',
  'content.imperialStrongholds.forge.lockedDesc':
    'Requires all six route strongholds taken and at least one audit passed.',
}

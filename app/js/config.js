// ── SUPABASE CONFIG ──────────────────────────────────────────
// To change the project, update these two values only
const SUPA_URL = 'https://gkyuvjpmhttzhyrtmkqp.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreXV2anBtaHR0emh5cnRta3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MzEyNzgsImV4cCI6MjA5MzMwNzI3OH0.8bShpz1gIWBgzjymgjfjL2q1w72JQCWn8qYSm3BXRKk';

const sb = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── CONSTANTS ────────────────────────────────────────────────
const COLORS = [
  ['#6B21A8','#E9D5FF'], ['#16A34A','#BBF7D0'], ['#DC2626','#FECACA'],
  ['#D97706','#FDE68A'], ['#0891B2','#A5F3FC'], ['#7C3AED','#DDD6FE'],
  ['#B45309','#FDE68A'], ['#0F766E','#99F6E4'], ['#BE185D','#FBCFE8'],
  ['#1D4ED8','#BFDBFE'], ['#4D7C0F','#D9F99D'], ['#9D174D','#FBCFE8'],
  ['#78716C','#E7E5E0']
];

const PT_LABELS    = ['0', '15', '30', '40'];
const FIRSTTO_OPTS = [3, 4, 5, 6, 7, 8, 9, 10];
const BO_OPTS      = [3, 5, 7, 9, 11];
const TOTAL_OPTS   = [4, 6, 8, 10, 12, 16];

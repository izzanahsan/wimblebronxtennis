// ── SUPABASE CONFIG ──────────────────────────────────────────
// To change the project, update these two values only
const SUPA_URL = 'https://gkyuvjpmhttzhyrtmkqp.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreXV2anBtaHR0emh5cnRta3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MzEyNzgsImV4cCI6MjA5MzMwNzI3OH0.8bShpz1gIWBgzjymgjfjL2q1w72JQCWn8qYSm3BXRKk';

const sb = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── CONSTANTS ────────────────────────────────────────────────
// Avatar [background, initials]: deep tones that sit with the badge;
// every pair is at least 5.9:1 so initials read in sunlight
const COLORS = [
  ['#54138B','#E9D5FF'], ['#026632','#C9F5DA'], ['#8C2340','#FBD5E0'],
  ['#7A4A00','#FDE7B0'], ['#0E5560','#BFF0F5'], ['#3E2A8C','#DDD6FE'],
  ['#6B3F12','#F5DFC0'], ['#0F5E52','#B9F2E6'], ['#8A1D5C','#FBCFE8'],
  ['#1E3A8A','#BFDBFE'], ['#3F5F0A','#DDF5B0'], ['#6B1530','#FBCFE0'],
  ['#4A4540','#EDEAE4']
];

const PT_LABELS    = ['0', '15', '30', '40'];
const FIRSTTO_OPTS = [3, 4, 5, 6, 7, 8, 9, 10];
const BO_OPTS      = [3, 5, 7, 9, 11];
const TOTAL_OPTS   = [4, 6, 8, 10, 12, 16];

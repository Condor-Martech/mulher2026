const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ezpdzyfbeyywpkmejunt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cGR6eWZiZXl5d3BrbWVqdW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTY1NDcsImV4cCI6MjA4ODAzMjU0N30.DnkhdN9M5RCyd9l8LYxqbOqEXBbJ9wPhCEOiUbz7Npw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  const payload1 = {
    p_event_id: 'event-11-mar',
    p_nome: 'Test',
    p_email: 'test@example.com',
    p_cpf: '12345678909',
    p_telefone: '1234567890',
    p_source: 'social',
    p_tema: ''
  };

  const payload2 = {
    ...payload1,
    p_opening_date: null
  };

  console.log("--- Testing Payload 1 (Without p_opening_date) ---");
  const res1 = await supabase.rpc('inscrever_participante', payload1);
  console.log(JSON.stringify(res1.error, null, 2));

  console.log("\n--- Testing Payload 2 (With p_opening_date: null) ---");
  const res2 = await supabase.rpc('inscrever_participante', payload2);
  console.log(JSON.stringify(res2.error, null, 2));
}

testRpc();

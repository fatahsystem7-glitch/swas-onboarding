import { query } from './pool.js';

export async function createClient(data) {
  const {
    business_name,
    contact_name,
    email,
    phone_number,
    ai_greeting,
    business_hours,
    emergency_number,
  } = data;

  const { rows } = await query(
    `INSERT INTO clients
       (business_name, contact_name, email, phone_number, ai_greeting, business_hours, emergency_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      business_name,
      contact_name || null,
      email,
      phone_number,
      ai_greeting || null,
      business_hours ? JSON.stringify(business_hours) : null,
      emergency_number || null,
    ],
  );
  return rows[0];
}

export async function updateClientProvisioning(id, fields) {
  const allowed = [
    'telnyx_number',
    'telnyx_number_order_id',
    'telnyx_requirement_group_id',
    'livekit_trunk_id',
    'livekit_dispatch_rule_id',
    'status',
  ];
  const sets = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return getClientById(id);
  values.push(id);
  const { rows } = await query(
    `UPDATE clients SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function getClientById(id) {
  const { rows } = await query('SELECT * FROM clients WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getClientByEmail(email) {
  const { rows } = await query('SELECT * FROM clients WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function getClientByTelnyxNumber(number) {
  const { rows } = await query('SELECT * FROM clients WHERE telnyx_number = $1', [number]);
  return rows[0] || null;
}

export async function getClientByOrderId(orderId) {
  const { rows } = await query('SELECT * FROM clients WHERE telnyx_number_order_id = $1', [orderId]);
  return rows[0] || null;
}

export async function getClientByRequirementGroup(groupId) {
  const { rows } = await query(
    'SELECT * FROM clients WHERE telnyx_requirement_group_id = $1',
    [groupId],
  );
  return rows[0] || null;
}

export async function setClientStatus(id, status) {
  const { rows } = await query(
    'UPDATE clients SET status = $1 WHERE id = $2 RETURNING *',
    [status, id],
  );
  return rows[0];
}

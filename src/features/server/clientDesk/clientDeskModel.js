/**
 * Contact-only clients for the connected Client desk: clients reached only through a follow-up
 * assigned to the member. A client the member can already open is shown in full elsewhere, so it
 * is left out here. Search covers only the permitted name, phone, email and ID.
 */
export function selectTaskClients(taskClients = [], visibleClients = [], query = '') {
  const visible = new Set(visibleClients.map((client) => client.client_id));
  const search = query.trim().toLowerCase();
  return taskClients.filter(
    (client) =>
      !visible.has(client.client_id) &&
      (!search ||
        [client.client_id, client.full_name, client.phone, client.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search)),
  );
}

export function getDisplayRole(effectiveRoles) {
  if (!effectiveRoles) return "User";
  if (effectiveRoles.isHubOwner) return "Hub Owner";
  if (effectiveRoles.isAppOwner) return "App Owner";
  return "User";
}

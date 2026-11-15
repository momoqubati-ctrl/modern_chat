import {
  canActOnRank,
  canCreateVoiceRoom,
  getPowerDefinitionByName,
  verAdminPanel,
  verRoomsOwner,
  verStealthPanel,
} from "@newchat/shared";
import type { OnlineUserSnapshot, PowerRole } from "@newchat/shared";

export function resolveMemberRole(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
  explicitRole?: PowerRole | null,
): PowerRole | null {
  if (explicitRole && explicitRole.name) return explicitRole;
  const roleName = user?.rank || user?.power || "";
  if (!roleName) return null;
  return getPowerDefinitionByName(powers, roleName) ?? null;
}

export function canAccessControlPanel(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
): boolean {
  if (!user) return false;
  return verAdminPanel(powers, user.rank || user.power || "");
}

export function canManageRooms(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
  explicitRole?: PowerRole | null,
): boolean {
  const role = resolveMemberRole(user, powers, explicitRole);
  if (role && Number(role.createroom || 0) > 0) return true;
  return verRoomsOwner(powers, user?.rank || user?.power || "");
}

export function canCreateVoiceRoomUser(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
  explicitRole?: PowerRole | null,
): boolean {
  if (!user) return false;
  const role = resolveMemberRole(user, powers, explicitRole);
  if (
    role &&
    (Number(role.can_create_voice_room || 0) > 0 ||
      Number(role.owner || 0) > 0 ||
      Number(role.cp || 0) > 0)
  ) {
    return true;
  }
  return canCreateVoiceRoom(powers, user.rank || user.power || "");
}

export function canToggleStealth(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
): boolean {
  if (!user) return false;
  return verStealthPanel(powers, user.rank || user.power || "");
}

export function canUseRoomManagement(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
): boolean {
  if (!user) return false;
  return verRoomsOwner(powers, user.rank || user.power || "");
}

export function canUseCompetitionBots(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
  explicitRole?: PowerRole | null,
): boolean {
  const role = resolveMemberRole(user, powers, explicitRole);
  return Boolean(role && (Number(role.brbbot || 0) > 0 || Number(role.owner || 0) > 0 || Number(role.cp || 0) > 0));
}

export function canManageTalkingBots(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
  explicitRole?: PowerRole | null,
): boolean {
  const role = resolveMemberRole(user, powers, explicitRole);
  return Boolean(role && (Number(role.bootedit || 0) > 0 || Number(role.owner || 0) > 0 || Number(role.cp || 0) > 0));
}

export function canModerateUser(
  actor: OnlineUserSnapshot | null | undefined,
  target: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
): boolean {
  if (!actor || !target || actor.id === target.id) return false;
  return canActOnRank(powers, actor.rank || actor.power || "", target.rank || target.power || "");
}

export function hasRoleFlag(
  user: OnlineUserSnapshot | null | undefined,
  powers: PowerRole[],
  flag: keyof PowerRole,
  explicitRole?: PowerRole | null,
): boolean {
  const role = resolveMemberRole(user, powers, explicitRole);
  if (!role) return false;
  return Number(role[flag] || 0) > 0;
}

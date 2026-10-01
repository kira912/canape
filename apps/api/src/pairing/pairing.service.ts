import { ConflictException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { PAIRING_TTL_SECONDS, type Pairing, type PairingInfo, type PairingStatus } from "@canape/shared";
import { HouseholdService } from "../household/household.service";
import { generateSessionToken, hashToken } from "../household/tokens";
import { PrismaService } from "../prisma/prisma.service";
import { describeUserAgent } from "./user-agent";

/**
 * QR sign-in. The QR only carries the pairing id; approving needs a signed-in
 * member, and receiving the session needs the secret that never left the new
 * device. A pairing expires after PAIRING_TTL_SECONDS and works once.
 */
@Injectable()
export class PairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly households: HouseholdService,
  ) {}

  async create(userAgent: string | undefined, now = new Date()): Promise<Pairing> {
    const secret = generateSessionToken();
    const pairing = await this.prisma.devicePairing.create({
      data: {
        secretHash: hashToken(secret),
        device: describeUserAgent(userAgent),
        expiresAt: new Date(now.getTime() + PAIRING_TTL_SECONDS * 1000),
      },
    });
    return { id: pairing.id, secret, expiresAt: pairing.expiresAt.toISOString() };
  }

  /** For the approval screen. */
  async info(id: string, now = new Date()): Promise<PairingInfo> {
    const pairing = await this.findOpen(id, now);
    return { device: pairing.device, expiresAt: pairing.expiresAt.toISOString() };
  }

  async approve(id: string, memberId: string, now = new Date()): Promise<void> {
    await this.findOpen(id, now);
    // Conditional update: two devices approving at once → only one wins.
    const { count } = await this.prisma.devicePairing.updateMany({
      where: { id, approvedAt: null, expiresAt: { gt: now } },
      data: { memberId, approvedAt: now },
    });
    if (count === 0) throw new ConflictException("Cet appareil a déjà été connecté");
  }

  /** Polled by the new device. */
  async claim(id: string, secret: string, now = new Date()): Promise<PairingStatus> {
    const pairing = await this.prisma.devicePairing.findUnique({
      where: { id },
      include: { member: { select: { householdId: true } } },
    });
    if (!pairing || pairing.secretHash !== hashToken(secret)) throw new NotFoundException("Appairage inconnu");
    if (pairing.claimedAt) throw new GoneException("Appairage déjà utilisé");
    if (!pairing.approvedAt || !pairing.member || !pairing.memberId) {
      if (pairing.expiresAt <= now) throw new GoneException("QR code expiré");
      return { status: "pending" };
    }
    const { count } = await this.prisma.devicePairing.updateMany({
      where: { id, claimedAt: null },
      data: { claimedAt: now },
    });
    if (count === 0) throw new GoneException("Appairage déjà utilisé");
    return {
      status: "approved",
      session: await this.households.openSession(pairing.memberId, pairing.member.householdId),
    };
  }

  private async findOpen(id: string, now: Date) {
    const pairing = await this.prisma.devicePairing.findUnique({ where: { id } });
    if (!pairing) throw new NotFoundException("QR code inconnu");
    if (pairing.approvedAt) throw new ConflictException("Cet appareil a déjà été connecté");
    if (pairing.expiresAt <= now) throw new GoneException("QR code expiré");
    return pairing;
  }
}

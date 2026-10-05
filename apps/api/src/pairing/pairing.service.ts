import { ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { PAIRING_TTL_SECONDS, type Pairing, type PairingInfo, type PairingStatus } from "@canape/shared";
import { HouseholdService } from "../household/household.service";
import { generateSessionToken, hashToken } from "../household/tokens";
import { PrismaService } from "../prisma/prisma.service";
import { randomInt } from "node:crypto";
import { describeUserAgent } from "./user-agent";

/** The new device's code + this many decoys on the approval screen. */
const DECOYS = 2;

const twoDigits = () => String(randomInt(10, 100));

/** Fisher–Yates: the right code is equally likely at every position. */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * QR sign-in. The QR only carries the pairing id; approving needs a signed-in
 * member, and receiving the session needs the secret that never left the new
 * device. A pairing expires after PAIRING_TTL_SECONDS and works once.
 *
 * Number matching: the approving member must pick the two digits shown on the
 * new device. Approving then takes having that screen in sight, so a pairing
 * link sent by someone else can't be approved in one tap; a wrong pick cancels it.
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
        verificationCode: twoDigits(),
        expiresAt: new Date(now.getTime() + PAIRING_TTL_SECONDS * 1000),
      },
    });
    return {
      id: pairing.id,
      secret,
      verificationCode: pairing.verificationCode,
      expiresAt: pairing.expiresAt.toISOString(),
    };
  }

  /** For the approval screen. */
  async info(id: string, now = new Date()): Promise<PairingInfo> {
    const pairing = await this.findOpen(id, now);
    const choices = new Set([pairing.verificationCode]);
    while (choices.size < DECOYS + 1) choices.add(twoDigits());
    return {
      device: pairing.device,
      choices: shuffle([...choices]),
      expiresAt: pairing.expiresAt.toISOString(),
    };
  }

  async approve(id: string, memberId: string, verificationCode: string, now = new Date()): Promise<void> {
    const pairing = await this.findOpen(id, now);
    if (!pairing.verificationCode || verificationCode !== pairing.verificationCode) {
      // One try: expire it, the new device shows a fresh QR (and code).
      await this.prisma.devicePairing.updateMany({ where: { id, approvedAt: null }, data: { expiresAt: now } });
      throw new ForbiddenException("Code de vérification incorrect");
    }
    // Conditional update: two devices approving at once → only one wins.
    const { count } = await this.prisma.devicePairing.updateMany({
      where: { id, approvedAt: null, expiresAt: { gt: now }, verificationCode },
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
    try {
      return {
        status: "approved",
        session: await this.households.openSession(pairing.memberId, pairing.member.householdId),
      };
    } catch (error) {
      // No session was handed over: let the next poll try again rather than burning the pairing.
      await this.prisma.devicePairing.updateMany({ where: { id, claimedAt: now }, data: { claimedAt: null } });
      throw error;
    }
  }

  private async findOpen(id: string, now: Date) {
    const pairing = await this.prisma.devicePairing.findUnique({ where: { id } });
    if (!pairing) throw new NotFoundException("QR code inconnu");
    if (pairing.approvedAt) throw new ConflictException("Cet appareil a déjà été connecté");
    if (pairing.expiresAt <= now) throw new GoneException("QR code expiré");
    return pairing;
  }
}

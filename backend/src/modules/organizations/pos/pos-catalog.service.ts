import {
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { branchScope } from '../authorization/resource-access';
import type { OrganizationContext } from '../authorization/organization-authorization.types';

export const posCatalogSelect = {
  id: true,
  sellingPrice: true,
  quantity: true,
  merchantBranch: { select: { status: true } },
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      merchant: { select: { name: true } },
    },
  },
} satisfies Prisma.BranchInventorySelect;

const POS_PAGE_SIZE = 15;
type PosCatalogItem = {
  branchInventoryId: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  merchantName: string;
  sellingPrice: string;
  quantity: number;
  participationStatus: 'ACTIVE' | 'INACTIVE';
  eligible: boolean;
};

export interface PosCatalogPage {
  items: PosCatalogItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

@Injectable()
export class PosCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    context: OrganizationContext,
    branchId: string,
    q?: string,
    cursor?: string,
  ): Promise<PosCatalogPage> {
    const normalizedQuery = q?.trim() ?? '';
    const decoded = cursor
      ? decodeCursor(cursor, context.organizationId, branchId, normalizedQuery)
      : null;
    const rows = await this.readRows(
      context,
      branchId,
      normalizedQuery
        ? {
            OR: [
              { name: { contains: normalizedQuery, mode: 'insensitive' } },
              { sku: { contains: normalizedQuery, mode: 'insensitive' } },
              { barcode: { contains: normalizedQuery } },
            ],
          }
        : {},
      decoded
        ? {
            OR: [
              { product: { name: { gt: decoded.name } } },
              {
                AND: [
                  { product: { name: decoded.name } },
                  { id: { gt: decoded.inventoryId } },
                ],
              },
            ],
          }
        : undefined,
      POS_PAGE_SIZE + 1,
    );
    const items = rows.slice(0, POS_PAGE_SIZE);
    const hasMore = rows.length > POS_PAGE_SIZE;
    const last = items.at(-1);
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              organizationId: context.organizationId,
              branchId,
              q: normalizedQuery,
              name: last.name,
              inventoryId: last.branchInventoryId,
            })
          : null,
    };
  }

  async findByCode(
    context: OrganizationContext,
    branchId: string,
    code: string,
  ) {
    return this.readRows(context, branchId, {
      OR: [{ sku: code.toUpperCase() }, { barcode: code }],
    });
  }

  private async readRows(
    context: OrganizationContext,
    branchId: string,
    filter: Prisma.ProductWhereInput,
    continuation?: Prisma.BranchInventoryWhereInput,
    take?: number,
  ) {
    if (!['OWNER', 'MANAGER', 'CASHIER'].includes(context.role))
      throw new ForbiddenException('Your organization role cannot access POS');
    const scope = branchScope(context);
    const branch = await this.prisma.branch.findFirst({
      where: { AND: [scope, { id: branchId }] },
      select: { id: true, status: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.status === 'INACTIVE') return [];
    const rows = await this.prisma.branchInventory.findMany({
      where: {
        organizationId: context.organizationId,
        branchId,
        branch: scope,
        product: {
          AND: [
            {
              organizationId: context.organizationId,
              status: 'ACTIVE',
              merchant: {
                organizationId: context.organizationId,
                status: 'ACTIVE',
              },
            },
            filter,
          ],
        },
        ...(continuation ? { AND: [continuation] } : {}),
      },
      select: posCatalogSelect,
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      ...(take ? { take } : {}),
    });
    return rows.map((row) => ({
      branchInventoryId: row.id,
      productId: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      barcode: row.product.barcode,
      merchantName: row.product.merchant.name,
      sellingPrice: row.sellingPrice.toFixed(2),
      quantity: row.quantity,
      participationStatus: row.merchantBranch.status,
      eligible: row.quantity > 0 && row.merchantBranch.status === 'ACTIVE',
    }));
  }
}

type PosCursor = {
  version: 1;
  organizationId: string;
  branchId: string;
  q: string;
  name: string;
  inventoryId: string;
};

function encodeCursor(cursor: Omit<PosCursor, 'version'>): string {
  return Buffer.from(JSON.stringify({ version: 1, ...cursor })).toString(
    'base64url',
  );
}

function decodeCursor(
  value: string,
  organizationId: string,
  branchId: string,
  q: string,
): Omit<PosCursor, 'version'> {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<PosCursor>;
    if (
      decoded.version !== 1 ||
      decoded.organizationId !== organizationId ||
      decoded.branchId !== branchId ||
      decoded.q !== q ||
      typeof decoded.name !== 'string' ||
      typeof decoded.inventoryId !== 'string'
    )
      throw new Error('invalid cursor');
    return {
      organizationId,
      branchId,
      q,
      name: decoded.name,
      inventoryId: decoded.inventoryId,
    };
  } catch {
    throw new BadRequestException('The POS catalog cursor is invalid');
  }
}

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { OrganizationContext } from './organization-authorization.types';
import {
  branchScope,
  inventoryScope,
  merchantScope,
  productScope,
} from './resource-access';

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(execution: ExecutionContext) {
    const request = execution
      .switchToHttp()
      .getRequest<Request & { organizationContext: OrganizationContext }>();
    const context = request.organizationContext;
    // Existing services already resolve every owner object within the tenant.
    if (context.role === 'OWNER') return true;
    const id = (value: unknown) => {
      if (value === undefined) return undefined;
      if (typeof value !== 'string' || !isUUID(value, '4'))
        throw new BadRequestException('Resource ID must be a UUID v4');
      return value;
    };
    const branchId = id(request.params.branchId);
    const productId = id(request.params.productId);
    const merchantId = id(
      request.params.merchantId ?? request.query.merchantId,
    );
    const inventoryId = id(request.params.inventoryId);
    if (
      branchId &&
      !(await this.prisma.branch.findFirst({
        where: { AND: [branchScope(context), { id: branchId }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Branch not found');
    if (
      productId &&
      !(await this.prisma.product.findFirst({
        where: { AND: [productScope(context), { id: productId }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Product not found');
    if (
      merchantId &&
      !(await this.prisma.merchant.findFirst({
        where: { AND: [merchantScope(context), { id: merchantId }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Merchant not found');
    if (
      inventoryId &&
      !(await this.prisma.branchInventory.findFirst({
        where: {
          AND: [inventoryScope(context), { id: inventoryId, branchId }],
        },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Branch inventory not found');
    // Placement candidates have the same visibility boundary as catalog reads.
    if (request.method === 'POST' && branchId && !inventoryId) {
      const body = request.body as { productId?: unknown } | undefined;
      const candidateId = id(body?.productId);
      if (
        candidateId &&
        !(await this.prisma.product.findFirst({
          where: { AND: [productScope(context), { id: candidateId }] },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Product not found');
    }
    return true;
  }
}

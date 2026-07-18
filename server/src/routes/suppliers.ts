
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { FastifyRequest } from 'fastify/types/request';
import type { FastifyReply } from 'fastify/types/reply';
import type { TipoDocumentoIdentidad, TipoPersona } from '@prisma/client';

import {
  getSuppliersDashboard,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../modules/suppliers/suppliers.service.js';

type GetSuppliersQueryParams = {
  search?: string;
  status?: 'activo' | 'inactivo';
};

type CreateSupplierBody = {
  tipoPersona?: TipoPersona;
  tipoDocumento?: TipoDocumentoIdentidad;
  numeroDocumento: string;
  razonSocial: string;
  nombreComercial?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  email?: string;
  direccion?: string;
  ubigeo?: string;
  observaciones?: string;
};

type UpdateSupplierBody = Partial<CreateSupplierBody> & { activo?: boolean };

const suppliersRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get(
    '/',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Querystring: GetSuppliersQueryParams }>, reply: FastifyReply) => {
      const { search, status } = request.query;
      const result = await getSuppliersDashboard({ search, status });
      return reply.send(result);
    }
  );

  fastify.post(
    '/',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: CreateSupplierBody }>, reply: FastifyReply) => {
      const result = await createSupplier(request.body, request);
      return reply.status(201).send(result);
    }
  );

  fastify.put(
    '/:id',
    { onRequest: [fastify.authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateSupplierBody;
      }>,
      reply: FastifyReply
    ) => {
      const result = await updateSupplier(request.params.id, request.body, request);
      return reply.send(result);
    }
  );

  fastify.delete(
    '/:id',
    { onRequest: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const result = await deleteSupplier(request.params.id, request);
      return reply.send(result);
    }
  );
};

export default suppliersRoutes;

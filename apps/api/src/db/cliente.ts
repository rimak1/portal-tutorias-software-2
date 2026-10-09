import type { Prisma, PrismaClient } from "@prisma/client";

/** Cliente de base de datos: el global o el ligado a una transaccion en curso. */
export type Cliente = PrismaClient | Prisma.TransactionClient;

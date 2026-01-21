import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Schemas de validación
const createAppointmentSchema = z.object({
  clientId: z.string().uuid(),
  date: z.string().datetime(),
  duration: z.number().min(15).max(480).default(60), // 15 min a 8 horas
  type: z.string().min(1).default('consultation'),
  notes: z.string().optional(),
});

const updateAppointmentSchema = z.object({
  date: z.string().datetime().optional(),
  duration: z.number().min(15).max(480).optional(),
  type: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export class AppointmentController {
  // Obtener todas las citas
  static async getAppointments(req: Request, res: Response) {
    try {
      const { 
        status, 
        clientId, 
        date, 
        upcoming = 'false',
        page = '1', 
        limit = '10' 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtros
      const where: any = {};
      
      if (status) {
        where.status = status;
      }
      
      if (clientId) {
        where.clientId = clientId;
      }
      
      if (date) {
        const targetDate = new Date(date as string);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
        
        where.date = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
      
      if (upcoming === 'true') {
        where.date = {
          gte: new Date(),
        };
      }

      const [appointments, total] = await Promise.all([
        prisma.appointment.findMany({
          where,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: { date: 'asc' },
          skip,
          take: limitNum,
        }),
        prisma.appointment.count({ where }),
      ]);

      res.json({
        appointments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error al obtener citas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener cita por ID
  static async getAppointmentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Cita no encontrada' });
      }

      res.json(appointment);
    } catch (error) {
      console.error('Error al obtener cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nueva cita
  static async createAppointment(req: Request, res: Response) {
    try {
      const validatedData = createAppointmentSchema.parse(req.body);
      const { clientId, date, duration, type, notes } = validatedData;

      // Verificar que el cliente existe
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      // Verificar disponibilidad de horario
      const appointmentDate = new Date(date);
      const endTime = new Date(appointmentDate.getTime() + duration * 60000);

      const conflictingAppointment = await prisma.appointment.findFirst({
        where: {
          date: {
            gte: appointmentDate,
            lt: endTime,
          },
        },
      });

      if (conflictingAppointment) {
        return res.status(400).json({ 
          error: 'Ya existe una cita programada en ese horario' 
        });
      }

      // Crear la cita
      const appointment = await prisma.appointment.create({
        data: {
          clientId,
          date: appointmentDate,
          duration,
          type,
          notes,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      }
      console.error('Error al crear cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar cita
  static async updateAppointment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateAppointmentSchema.parse(req.body);

      // Verificar que la cita existe
      const existingAppointment = await prisma.appointment.findUnique({
        where: { id },
      });

      if (!existingAppointment) {
        return res.status(404).json({ error: 'Cita no encontrada' });
      }

      // Si se actualiza la fecha/hora, verificar disponibilidad
      if (validatedData.date || validatedData.duration) {
        const appointmentDate = validatedData.date 
          ? new Date(validatedData.date)
          : existingAppointment.date;
        
        const duration = validatedData.duration || existingAppointment.duration;
        const endTime = new Date(appointmentDate.getTime() + duration * 60000);

        const conflictingAppointment = await prisma.appointment.findFirst({
          where: {
            id: { not: id },
            date: {
              gte: appointmentDate,
              lt: endTime,
            },
          },
        });

        if (conflictingAppointment) {
          return res.status(400).json({ 
            error: 'Ya existe una cita programada en ese horario' 
          });
        }
      }

      const appointment = await prisma.appointment.update({
        where: { id },
        data: validatedData,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      }
      console.error('Error al actualizar cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar cita
  static async deleteAppointment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const appointment = await prisma.appointment.findUnique({
        where: { id },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Cita no encontrada' });
      }

      await prisma.appointment.delete({
        where: { id },
      });

      res.json({ message: 'Cita eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }



  // Obtener disponibilidad de horarios
  static async getAvailability(req: Request, res: Response) {
    try {
      const { date, duration = '60' } = req.query;
      
      if (!date) {
        return res.status(400).json({ error: 'Fecha requerida' });
      }

      const targetDate = new Date(date as string);
      const startOfDay = new Date(targetDate.setHours(8, 0, 0, 0)); // 8 AM
      const endOfDay = new Date(targetDate.setHours(18, 0, 0, 0)); // 6 PM
      const appointmentDuration = parseInt(duration as string);

      // Obtener citas existentes del día
      const existingAppointments = await prisma.appointment.findMany({
        where: {
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        orderBy: { date: 'asc' },
      });

      // Generar slots disponibles (cada 30 minutos)
      const availableSlots = [];
      const slotDuration = 30; // minutos
      
      for (let hour = 8; hour < 18; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const slotStart = new Date(targetDate);
          slotStart.setHours(hour, minute, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + appointmentDuration * 60000);

          // Verificar si el slot no se superpone con citas existentes
          const hasConflict = existingAppointments.some(appointment => {
            const appointmentStart = new Date(appointment.date);
            const appointmentEnd = new Date(appointmentStart.getTime() + appointment.duration * 60000);
            
            return (
              (slotStart >= appointmentStart && slotStart < appointmentEnd) ||
              (slotEnd > appointmentStart && slotEnd <= appointmentEnd) ||
              (slotStart <= appointmentStart && slotEnd >= appointmentEnd)
            );
          });

          if (!hasConflict && slotEnd <= endOfDay) {
            availableSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            });
          }
        }
      }

      res.json({ availableSlots });
    } catch (error) {
      console.error('Error al obtener disponibilidad:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}
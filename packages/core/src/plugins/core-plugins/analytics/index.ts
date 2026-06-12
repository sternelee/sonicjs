/**
 * Core Analytics Plugin — Payload-shaped port.
 *
 * Stub-grade analytics tracking + reporting routes. Legacy non-typed hooks
 * (request:start, request:end, user:login, content:view) subscribe via the
 * raw bus in onBoot. Service/middleware/model declarations from the old
 * PluginBuilder shape are dropped; they were stubs the runtime never wired.
 */

import { Hono } from 'hono'
import { definePlugin } from '../../sdk/define-plugin'
import { analyticsAdminRoutes } from './routes/admin'

const analyticsAPI = new Hono()

analyticsAPI.get('/stats', async (c) => {
  const timeRange = c.req.query('range') || '7d'
  return c.json({
    message: 'Analytics stats',
    data: {
      pageviews: 12500,
      uniqueVisitors: 3200,
      sessions: 4800,
      avgSessionDuration: 245,
      bounceRate: 0.35,
      topPages: [
        { path: '/', views: 3200 },
        { path: '/about', views: 1800 },
        { path: '/contact', views: 950 },
      ],
      timeRange,
    },
  })
})

analyticsAPI.post('/track', async (c) => {
  const event = await c.req.json()
  console.info('Analytics event tracked:', event)
  return c.json({ message: 'Event tracked successfully', eventId: `event-${Date.now()}` })
})

analyticsAPI.get('/reports', async (c) => {
  const reportType = c.req.query('type') || 'traffic'
  const startDate = c.req.query('start')
  const endDate = c.req.query('end')
  return c.json({
    message: 'Analytics report',
    data: { reportType, dateRange: { start: startDate, end: endDate }, data: [] },
  })
})

analyticsAPI.get('/realtime', async (c) => {
  return c.json({
    message: 'Real-time analytics',
    data: {
      activeUsers: 23,
      activePages: [
        { path: '/', users: 8 },
        { path: '/blog', users: 5 },
        { path: '/products', users: 4 },
      ],
      recentEvents: [],
    },
  })
})

const trackRequestStart = async (data: any) => {
  data.analytics = {
    startTime: Date.now(),
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }
  return data
}

const trackRequestEnd = async (data: any) => {
  if (data.analytics) {
    const duration = Date.now() - data.analytics.startTime
    console.debug(`Request completed in ${duration}ms`)
  }
  return data
}

export const analyticsPlugin = definePlugin({
  id: 'core-analytics',
  version: '1.0.0',
  name: 'Analytics',
  description: 'Core analytics tracking and reporting plugin.',
  sonicjsVersionRange: '^3.0.0',
  author: { name: 'SonicJS Team', email: 'team@sonicjs.com' },

  register(app) {
    app.route('/api/analytics', analyticsAPI)
    app.route('/admin/analytics', analyticsAdminRoutes as any)
  },

  menu: [
    {
      label: 'Analytics',
      path: '/admin/analytics',
      icon: 'chart',
      order: 40,
      permissions: ['admin', 'analytics:read'],
    },
  ],

  async onBoot(ctx) {
    const hooks = (ctx.raw as any)?.hooks
    if (!hooks?.register) return
    hooks.register('request:start', trackRequestStart, 1)
    hooks.register('request:end', trackRequestEnd, 1)
    hooks.register('user:login', async (data: any, context: any) => {
      await context.services?.analyticsService?.trackEvent({
        eventType: 'auth',
        eventName: 'user_login',
        userId: data.userId,
        eventData: { loginMethod: data.method },
      })
      return data
    }, 8)
    hooks.register('content:view', async (data: any, context: any) => {
      await context.services?.analyticsService?.trackEvent({
        eventType: 'content',
        eventName: 'content_view',
        eventData: { contentId: data.id, contentType: data.type, title: data.title },
      })
      return data
    }, 8)
  },
})

export function createAnalyticsPlugin() {
  return analyticsPlugin
}

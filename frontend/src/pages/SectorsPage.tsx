import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import { Briefcase, ArrowUpRight } from 'lucide-react'
import { useDashboard } from '@/hooks/useAnalytics'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SECTOR_NAMES, SECTOR_COLORS } from '@/lib/utils'

export default function SectorsPage() {
  const { data: dashboard, isLoading } = useDashboard()
  const navigate = useNavigate()

  const sectors = Object.entries(dashboard?.leads_by_sector ?? {}).map(
    ([code, count]) => ({
      id: code,
      code,
      name: SECTOR_NAMES[code] ?? code,
      color: SECTOR_COLORS[code] ?? '#3B82F6',
      leadCount: count as number,
    }),
  )

  const chartData = sectors.map((s) => ({
    sector: s.name,
    count: s.leadCount,
    color: s.color,
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Sectors Overview
        </h1>
        <p className="text-muted-foreground mt-1">
          Analyze your lead distribution and performance across different industries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Sector Distribution</CardTitle>
            <CardDescription>Breakdown of your total leads by industry</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={100}
                    outerRadius={140}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="sector"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => [value, 'Leads']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No sector data available.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Target Sectors</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-8 h-8 rounded-md" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-4 w-12" />
                      </div>
                    ))}
                </div>
              ) : sectors.length > 0 ? (
                <div className="space-y-1">
                  {sectors.map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() =>
                        navigate(`/leads?sector_code=${encodeURIComponent(sector.code)}`)
                      }
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center"
                          style={{
                            backgroundColor: `${sector.color}20`,
                            color: sector.color,
                          }}
                        >
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-foreground">
                          {sector.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-muted-foreground">
                          {sector.leadCount} leads
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No sectors available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground border-transparent">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2">Want to expand?</h3>
              <p className="text-primary-foreground/80 text-sm mb-4">
                LeadForge AI can automatically discover new high-potential sectors based
                on your current won leads.
              </p>
              <Button variant="secondary" className="w-full font-medium">
                Run Sector Analysis
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

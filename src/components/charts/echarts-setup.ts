// ECharts runtime setup, imported only by chart components so the echarts
// vendor chunk stays out of the initial bundle (see
// docs/prd/frontend-performance.md R2). Each chart component imports EChart
// from here instead of relying on the former global registration.
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { DatasetComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import EChart from 'vue-echarts'

use([SVGRenderer, BarChart, LineChart, PieChart, DatasetComponent, GridComponent, LegendComponent, TooltipComponent])

export default EChart

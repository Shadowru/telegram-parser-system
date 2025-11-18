// dashboard/src/pages/Dashboard.tsx
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Message as MessageIcon,
  Work as WorkIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { apiService } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => apiService.getSystemStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading dashboard: {error.message}
      </Alert>
    );
  }

  const messageChartData = {
    labels: stats?.messages_timeline?.labels || [],
    datasets: [
      {
        label: 'Messages Collected',
        data: stats?.messages_timeline?.data || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const channelChartData = {
    labels: stats?.top_channels?.map((c: any) => c.username) || [],
    datasets: [
      {
        label: 'Messages',
        data: stats?.top_channels?.map((c: any) => c.message_count) || [],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
      },
    ],
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Messages
                  </Typography>
                  <Typography variant="h4">
                    {stats?.total_messages?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +{stats?.messages_today?.toLocaleString() || 0} today
                  </Typography>
                </Box>
                <MessageIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Channels
                  </Typography>
                  <Typography variant="h4">
                    {stats?.active_channels || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    of {stats?.total_channels || 0} total
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 48, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Jobs
                  </Typography>
                  <Typography variant="h4">
                    {stats?.active_jobs || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.pending_jobs || 0} pending
                  </Typography>
                </Box>
                <WorkIcon sx={{ fontSize: 48, color: 'warning.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Workers
                  </Typography>
                  <Typography variant="h4">
                    {stats?.active_workers || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats?.total_workers || 0} total
                  </Typography>
                </Box>
                <ComputerIcon sx={{ fontSize: 48, color: 'info.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Messages Timeline (Last 7 Days)
            </Typography>
            <Line
              data={messageChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                },
              }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Channels
            </Typography>
            <Bar
              data={channelChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
              }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
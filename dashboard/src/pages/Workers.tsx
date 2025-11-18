// dashboard/src/pages/Workers.tsx
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';

interface Worker {
  worker_id: string;
  worker_name: string;
  hostname: string;
  location: string;
  status: string;
  last_heartbeat: string;
  jobs_completed: number;
  jobs_failed: number;
  messages_processed: number;
  started_at: string;
  metadata: any;
}

const Workers: React.FC = () => {
  const { data: workers, isLoading, error } = useQuery({
    queryKey: ['workers'],
    queryFn: () => apiService.getWorkers(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'busy':
        return 'success';
      case 'idle':
        return 'info';
      case 'offline':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'busy':
        return <CheckCircleIcon />;
      case 'idle':
        return <HourglassIcon />;
      case 'error':
        return <ErrorIcon />;
      default:
        return <ComputerIcon />;
    }
  };

  const getTimeSinceHeartbeat = (lastHeartbeat: string) => {
    const now = new Date().getTime();
    const last = new Date(lastHeartbeat).getTime();
    const diff = Math.floor((now - last) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getUptime = (startedAt: string) => {
    const now = new Date().getTime();
    const start = new Date(startedAt).getTime();
    const diff = Math.floor((now - start) / 1000);

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const calculateSuccessRate = (completed: number, failed: number) => {
    const total = completed + failed;
    if (total === 0) return 100;
    return Math.round((completed / total) * 100);
  };

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
        Error loading workers: {error.message}
      </Alert>
    );
  }

  const activeWorkers = workers?.filter((w: Worker) => 
    w.status === 'active' || w.status === 'busy'
  ).length || 0;

  const totalMessages = workers?.reduce((sum: number, w: Worker) => 
    sum + (w.messages_processed || 0), 0
  ) || 0;

  const totalJobs = workers?.reduce((sum: number, w: Worker) => 
    sum + (w.jobs_completed || 0) + (w.jobs_failed || 0), 0
  ) || 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Workers
      </Typography>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Workers
              </Typography>
              <Typography variant="h4">
                {workers?.length || 0}
              </Typography>
              <Typography variant="body2" color="success.main">
                {activeWorkers} active
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Messages Processed
              </Typography>
              <Typography variant="h4">
                {totalMessages.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Jobs Completed
              </Typography>
              <Typography variant="h4">
                {totalJobs.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Success Rate
              </Typography>
              <Typography variant="h4">
                {workers?.length > 0
                  ? Math.round(
                      workers.reduce((sum: number, w: Worker) => 
                        sum + calculateSuccessRate(w.jobs_completed, w.jobs_failed), 0
                      ) / workers.length
                    )
                  : 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Workers Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Worker</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Heartbeat</TableCell>
              <TableCell>Uptime</TableCell>
              <TableCell align="right">Jobs</TableCell>
              <TableCell align="right">Messages</TableCell>
              <TableCell>Success Rate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workers?.map((worker: Worker) => {
              const successRate = calculateSuccessRate(
                worker.jobs_completed,
                worker.jobs_failed
              );

              return (
                <TableRow key={worker.worker_id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(worker.status)}
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {worker.worker_name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {worker.worker_id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{worker.location}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {worker.hostname}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={worker.status}
                      color={getStatusColor(worker.status)}
                      size="small"
                    />
                  </TableCell>

                  <TableCell>
                    <Tooltip title={new Date(worker.last_heartbeat).toLocaleString()}>
                      <Typography variant="body2">
                        {getTimeSinceHeartbeat(worker.last_heartbeat)}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {getUptime(worker.started_at)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" color="success.main">
                      {worker.jobs_completed}
                    </Typography>
                    {worker.jobs_failed > 0 && (
                      <Typography variant="caption" color="error.main">
                        {worker.jobs_failed} failed
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2">
                      {worker.messages_processed.toLocaleString()}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box flexGrow={1}>
                        <LinearProgress
                          variant="determinate"
                          value={successRate}
                          color={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Typography variant="body2" minWidth={45}>
                        {successRate}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {workers?.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography color="textSecondary">
            No workers found
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Workers;
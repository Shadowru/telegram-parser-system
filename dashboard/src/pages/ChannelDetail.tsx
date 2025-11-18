// dashboard/src/pages/ChannelDetail.tsx
import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  CircularProgress,
  //@ts-ignore
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayIcon,
  //@ts-ignore
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { apiService } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ChannelDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { data: channel, isLoading: channelLoading } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => apiService.getChannel(Number(id)),
  });

  //@ts-ignore
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['channel-stats', id],
    queryFn: () => apiService.getChannelStats(Number(id)),
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['channel-messages', id, page, rowsPerPage],
    queryFn: () => apiService.getChannelMessages(Number(id), {
      limit: rowsPerPage,
      offset: page * rowsPerPage,
    }),
    enabled: tabValue === 1,
  });

  const { data: analytics } = useQuery({
    queryKey: ['channel-analytics', id],
    queryFn: () => apiService.getChannelAnalytics(Number(id)),
    enabled: tabValue === 2,
  });

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (channelLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!channel) {
    return <Alert severity="error">Channel not found</Alert>;
  }

  const viewsChartData = {
    labels: analytics?.timeline?.labels || [],
    datasets: [
      {
        label: 'Average Views',
        data: analytics?.timeline?.avg_views || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
      },
    ],
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/channels')}
        >
          Back
        </Button>
        <Box flexGrow={1}>
          <Typography variant="h4">{channel.title || channel.username}</Typography>
          <Typography variant="body2" color="textSecondary">
            @{channel.username}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PlayIcon />}
          onClick={() => apiService.triggerParse(Number(id))}
        >
          Parse Now
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Members
              </Typography>
              <Typography variant="h4">
                {channel.members_count?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Messages
              </Typography>
              <Typography variant="h4">
                {stats?.total_messages?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Views
              </Typography>
              <Typography variant="h4">
                {stats?.avg_views?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Status
              </Typography>
              <Chip
                label={channel.status}
                color={channel.status === 'active' ? 'success' : 'default'}
              />
              <Typography variant="body2" color="textSecondary" mt={1}>
                Last parsed: {channel.last_parsed_at
                  ? new Date(channel.last_parsed_at).toLocaleString()
                  : 'Never'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Overview" />
          <Tab label="Messages" />
          <Tab label="Analytics" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Channel Information
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>@{channel.username}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>{channel.title || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell>{channel.description || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Members</TableCell>
                    <TableCell>{channel.members_count?.toLocaleString() || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Parse Frequency</TableCell>
                    <TableCell>{channel.parse_frequency} seconds</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Created</TableCell>
                    <TableCell>{new Date(channel.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Total Messages</TableCell>
                    <TableCell>{stats?.total_messages?.toLocaleString() || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Average Views</TableCell>
                    <TableCell>{stats?.avg_views?.toLocaleString() || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Last Message</TableCell>
                    <TableCell>
                      {stats?.last_message_date
                        ? new Date(stats.last_message_date).toLocaleString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>First Message</TableCell>
                    <TableCell>
                      {stats?.first_message_date
                        ? new Date(stats.first_message_date).toLocaleString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Messages Tab */}
        <TabPanel value={tabValue} index={1}>
          {messagesLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Text</TableCell>
                      <TableCell align="right">Views</TableCell>
                      <TableCell align="right">Forwards</TableCell>
                      <TableCell align="right">Replies</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {messages?.items?.map((message: any) => (
                      <TableRow key={message.id} hover>
                        <TableCell>
                          {new Date(message.date).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {message.text || <em>No text</em>}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {message.views?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell align="right">
                          {message.forwards?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell align="right">
                          {message.replies?.toLocaleString() || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={messages?.total || 0}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Views Timeline (Last 30 Days)
          </Typography>
          <Line
            data={viewsChartData}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'top' as const,
                },
              },
            }}
          />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default ChannelDetail;
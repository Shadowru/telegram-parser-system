# data-collector/src/monitoring/metrics.py
from prometheus_client import Counter, Gauge, Histogram, generate_latest
import time
from typing import Dict, Any

class MetricsCollector:
    """Prometheus metrics collector"""
    
    def __init__(self):
        # Counters
        self.messages_received = Counter(
            'collector_messages_received_total',
            'Total number of messages received',
            ['worker_id', 'channel_id']
        )
        
        self.messages_processed = Counter(
            'collector_messages_processed_total',
            'Total number of messages processed',
            ['status']
        )
        
        self.batches_received = Counter(
            'collector_batches_received_total',
            'Total number of batches received',
            ['worker_id']
        )
        
        self.api_requests = Counter(
            'collector_api_requests_total',
            'Total API requests',
            ['endpoint', 'method', 'status']
        )
        
        self.db_operations = Counter(
            'collector_db_operations_total',
            'Total database operations',
            ['operation', 'status']
        )
        
        # Gauges
        self.queue_size = Gauge(
            'collector_queue_size',
            'Current queue size'
        )
        
        self.active_workers = Gauge(
            'collector_active_workers',
            'Number of active workers'
        )
        
        self.processing_lag = Gauge(
            'collector_processing_lag_seconds',
            'Processing lag in seconds'
        )
        
        # Histograms
        self.batch_processing_duration = Histogram(
            'collector_batch_processing_duration_seconds',
            'Batch processing duration',
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
        )
        
        self.db_write_duration = Histogram(
            'collector_db_write_duration_seconds',
            'Database write duration',
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0]
        )
        
        self.api_request_duration = Histogram(
            'collector_api_request_duration_seconds',
            'API request duration',
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0]
        )
    
    def record_message_received(self, worker_id: str, channel_id: int, count: int):
        """Record received messages"""
        self.messages_received.labels(
            worker_id=worker_id,
            channel_id=str(channel_id)
        ).inc(count)
    
    def record_batch_received(self, worker_id: str):
        """Record received batch"""
        self.batches_received.labels(worker_id=worker_id).inc()
    
    def record_message_processed(self, status: str, count: int):
        """Record processed messages"""
        self.messages_processed.labels(status=status).inc(count)
    
    def record_api_request(self, endpoint: str, method: str, status: int, duration: float):
        """Record API request"""
        self.api_requests.labels(
            endpoint=endpoint,
            method=method,
            status=str(status)
        ).inc()
        
        self.api_request_duration.observe(duration)
    
    def record_db_operation(self, operation: str, status: str, duration: float):
        """Record database operation"""
        self.db_operations.labels(
            operation=operation,
            status=status
        ).inc()
        
        self.db_write_duration.observe(duration)
    
    def update_queue_size(self, size: int):
        """Update queue size"""
        self.queue_size.set(size)
    
    def update_active_workers(self, count: int):
        """Update active workers count"""
        self.active_workers.set(count)
    
    def update_processing_lag(self, lag_seconds: float):
        """Update processing lag"""
        self.processing_lag.set(lag_seconds)
    
    def observe_batch_processing(self, duration: float):
        """Observe batch processing duration"""
        self.batch_processing_duration.observe(duration)
    
    def generate_metrics(self) -> bytes:
        """Generate Prometheus metrics"""
        return generate_latest()
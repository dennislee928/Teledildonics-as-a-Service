use crate::model::DeviceState;

pub trait DeviceBackend {
    fn scan_devices(&self) -> Vec<DeviceState>;
    fn apply(&mut self, device_id: &str, intensity: u8, duration_ms: u64, pattern_id: &str);
    fn stop_all(&mut self, device_id: &str);
    fn background_permission_lost(&mut self, device_id: &str);
}

#[derive(Clone, Debug, Default)]
pub struct MockDeviceBackend {
    devices: Vec<DeviceState>,
}

impl MockDeviceBackend {
    pub fn with_device(device_id: &str) -> Self {
        Self {
            devices: vec![DeviceState {
                device_id: device_id.to_string(),
                connected: true,
                last_command_sequence: 0,
                active_pattern: "idle".to_string(),
                current_intensity: 0,
            }],
        }
    }

    fn device_mut(&mut self, device_id: &str) -> Option<&mut DeviceState> {
        self.devices
            .iter_mut()
            .find(|device| device.device_id == device_id)
    }
}

impl DeviceBackend for MockDeviceBackend {
    fn scan_devices(&self) -> Vec<DeviceState> {
        self.devices.clone()
    }

    fn apply(&mut self, device_id: &str, intensity: u8, _duration_ms: u64, pattern_id: &str) {
        if let Some(device) = self.device_mut(device_id) {
            device.current_intensity = intensity;
            device.active_pattern = pattern_id.to_string();
            device.last_command_sequence += 1;
        }
    }

    fn stop_all(&mut self, device_id: &str) {
        if let Some(device) = self.device_mut(device_id) {
            device.current_intensity = 0;
            device.active_pattern = "stopped".to_string();
        }
    }

    fn background_permission_lost(&mut self, device_id: &str) {
        if let Some(device) = self.device_mut(device_id) {
            device.connected = false;
            device.current_intensity = 0;
            device.active_pattern = "background-permission-lost".to_string();
        }
    }
}

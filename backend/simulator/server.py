import asyncio
import math
import random
from asyncua import Server
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_simulator():
    # Initialize the OPC UA server
    server = Server()
    await server.init()

    # Set the endpoint address that clients will connect to
    server.set_endpoint("opc.tcp://localhost:4840")
    server.set_server_name("Industrial AI Toolkit - Simulator")

    # Register a custom namespace for our tags
    # Namespace 0 is reserved for the OPC UA standard
    uri = "http://industrial-ai-toolkit.local"
    namespace = await server.register_namespace(uri)

    # Get the root Objects node and create a folder for our device
    objects = server.get_objects_node()
    device = await objects.add_object(namespace, "SimulatedDevice")

    # Add sensor tag nodes under the device folder with initial values
    temperature = await device.add_variable(namespace, "Temperature", 25.0)
    pressure = await device.add_variable(namespace, "Pressure", 101.3)
    flow_rate = await device.add_variable(namespace, "FlowRate", 50.0)
    is_running = await device.add_variable(namespace, "IsRunning", True)

    # Allow clients to write values to these tags
    await temperature.set_writable()
    await pressure.set_writable()
    await flow_rate.set_writable()

    logger.info("OPC UA Simulator starting on opc.tcp://localhost:4840")
    logger.info("Tags: Temperature, Pressure, FlowRate, IsRunning")

    async with server:
        tick = 0
        while True:
            tick += 1

            # Simulate realistic sensor readings using sine waves + random noise
            # This mimics how real industrial sensors fluctuate over time
            temp_value = 25.0 + 10.0 * math.sin(tick * 0.1) + random.uniform(-0.5, 0.5)
            pressure_value = 101.3 + 5.0 * math.cos(tick * 0.05) + random.uniform(-0.2, 0.2)
            flow_value = 50.0 + 20.0 * math.sin(tick * 0.07) + random.uniform(-1.0, 1.0)

            # Write updated values to the OPC UA server nodes
            await temperature.write_value(round(temp_value, 2))
            await pressure.write_value(round(pressure_value, 2))
            await flow_rate.write_value(round(flow_value, 2))

            # Wait 1 second before next update cycle
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(run_simulator())
import random

def generate_simulated_csi(room_size, num_people, num_antennas):
    positions = []
    for _ in range(num_people):
        positions.append([
            random.uniform(0, room_size-1),
            random.uniform(0, room_size-1)
        ])
    return positions, None
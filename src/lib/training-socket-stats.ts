let trainingSocketConnections = 0;

export function incrementTrainingSocketConnections(): void {
  trainingSocketConnections += 1;
}

export function decrementTrainingSocketConnections(): void {
  trainingSocketConnections = Math.max(0, trainingSocketConnections - 1);
}

export function getTrainingSocketConnectionCount(): number {
  return trainingSocketConnections;
}

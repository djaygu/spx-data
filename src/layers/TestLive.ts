import { Layer } from 'effect'
import { ThetaDataApiClientTest } from './ThetaDataApiClientTest'

export const TestLive = Layer.mergeAll(ThetaDataApiClientTest)

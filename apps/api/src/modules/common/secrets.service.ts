import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  GetSecretValueCommand,
  SecretsManagerClient
} from '@aws-sdk/client-secrets-manager';

type JwtSecrets = {
  accessSecret: string;
  refreshSecret: string;
};

@Injectable()
export class SecretsService implements OnModuleInit {
  private jwtSecrets: JwtSecrets | null = null;

  private isLocalRuntime(): boolean {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' || env === 'test';
  }

  private mustEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is required`);
    }
    return value;
  }

  private async loadFromAwsSecretsManager(): Promise<JwtSecrets> {
    const region = this.mustEnv('SECRET_MANAGER_REGION');
    const accessSecretId = this.mustEnv('JWT_ACCESS_SECRET_ID');
    const refreshSecretId = this.mustEnv('JWT_REFRESH_SECRET_ID');

    const client = new SecretsManagerClient({ region });

    const [accessValue, refreshValue] = await Promise.all([
      client.send(new GetSecretValueCommand({ SecretId: accessSecretId })),
      client.send(new GetSecretValueCommand({ SecretId: refreshSecretId }))
    ]);

    const accessSecret = accessValue.SecretString;
    const refreshSecret = refreshValue.SecretString;

    if (!accessSecret || !refreshSecret) {
      throw new Error('Secrets manager returned empty JWT secret values');
    }

    return {
      accessSecret,
      refreshSecret
    };
  }

  async onModuleInit(): Promise<void> {
    if (this.isLocalRuntime()) {
      this.jwtSecrets = {
        accessSecret: this.mustEnv('JWT_ACCESS_SECRET'),
        refreshSecret: this.mustEnv('JWT_REFRESH_SECRET')
      };
      return;
    }

    const provider = process.env.SECRET_MANAGER_PROVIDER;
    if (provider !== 'aws') {
      throw new Error('SECRET_MANAGER_PROVIDER must be set to aws for non-local runtime');
    }

    this.jwtSecrets = await this.loadFromAwsSecretsManager();
  }

  getJwtSecrets(): JwtSecrets {
    if (!this.jwtSecrets) {
      throw new Error('JWT secrets are not initialized');
    }

    return this.jwtSecrets;
  }
}

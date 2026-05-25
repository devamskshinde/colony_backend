'use strict';

const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(5000),
  HOST: Joi.string().default('0.0.0.0'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().default('colony'),
  DB_USER: Joi.string().default('colony_user'),
  DB_PASSWORD: Joi.string().required(),
  DB_POOL_MAX: Joi.number().default(100),

  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ADMIN_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRY: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: Joi.string().default('30d'),

  REQUEST_SIGNING_SECRET: Joi.string().min(32).required(),
  DEVICE_SECRET: Joi.string().min(32).required(),

  RABBITMQ_URL: Joi.string().default('amqp://colony:colony_rabbit_dev@localhost:5672'),

  TWILIO_SID: Joi.string().allow('').default(''),
  TWILIO_AUTH_TOKEN: Joi.string().allow('').default(''),
  TWILIO_PHONE: Joi.string().allow('').default(''),

  OTP_MOCK: Joi.boolean().default(true),
}).unknown(true);

const { error, value: env } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false,
});

if (error) {
  const missing = error.details.map(d => d.message).join('\n  ');
  console.error(`\n❌ Environment validation failed:\n  ${missing}\n`);
  process.exit(1);
}

module.exports = {
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  HOST: env.HOST,

  DB_HOST: env.DB_HOST,
  DB_PORT: env.DB_PORT,
  DB_NAME: env.DB_NAME,
  DB_USER: env.DB_USER,
  DB_PASSWORD: env.DB_PASSWORD,
  DB_POOL_MAX: env.DB_POOL_MAX,

  REDIS_HOST: env.REDIS_HOST,
  REDIS_PORT: env.REDIS_PORT,
  REDIS_PASSWORD: env.REDIS_PASSWORD,

  JWT_SECRET: env.JWT_SECRET,
  JWT_ADMIN_SECRET: env.JWT_ADMIN_SECRET,
  JWT_EXPIRY: env.JWT_EXPIRY,
  REFRESH_TOKEN_EXPIRY: env.REFRESH_TOKEN_EXPIRY,

  REQUEST_SIGNING_SECRET: env.REQUEST_SIGNING_SECRET,
  DEVICE_SECRET: env.DEVICE_SECRET,

  RABBITMQ_URL: env.RABBITMQ_URL,

  TWILIO_SID: env.TWILIO_SID,
  TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE: env.TWILIO_PHONE,

  OTP_MOCK: env.OTP_MOCK,

  IS_PRODUCTION: env.NODE_ENV === 'production',
  IS_DEVELOPMENT: env.NODE_ENV === 'development',
};

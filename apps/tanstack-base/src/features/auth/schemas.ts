import * as v from 'valibot'

export const SignInSchema = v.object({
  email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address')),
  password: v.pipe(v.string(), v.nonEmpty('Password is required')),
})

export const SignUpSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty('Name is required')),
  email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address')),
  password: v.pipe(v.string(), v.minLength(8, 'At least 8 characters')),
})

export const ForgotPasswordSchema = v.object({
  email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address')),
})

export const ResetPasswordSchema = v.pipe(
  v.object({
    password: v.pipe(v.string(), v.minLength(8, 'At least 8 characters')),
    confirmPassword: v.pipe(v.string(), v.nonEmpty('Confirmation is required')),
  }),
  v.forward(
    v.check(
      ({ password, confirmPassword }) => password === confirmPassword,
      'Passwords do not match',
    ),
    ['confirmPassword'],
  ),
)

export type SignInInput = v.InferInput<typeof SignInSchema>
export type SignUpInput = v.InferInput<typeof SignUpSchema>
export type ForgotPasswordInput = v.InferInput<typeof ForgotPasswordSchema>
export type ResetPasswordInput = v.InferInput<typeof ResetPasswordSchema>

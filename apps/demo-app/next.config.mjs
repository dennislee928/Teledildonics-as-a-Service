/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@dennislee928/nothingx-react-components'],
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    }
};

export default nextConfig;

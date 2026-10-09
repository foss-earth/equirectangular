/** Source sampling/transfer fragment owned here; no shader device is created. */
export const EQUIRECT_UV_WGSL = /* wgsl */ `
fn panoramaEquirectUv(image: vec3<f32>) -> vec2<f32> {
  let d = normalize(image);
  return vec2<f32>(atan2(d.x, d.y) / 6.283185307179586 + 0.5, 0.5 - asin(clamp(d.z, -1.0, 1.0)) / 3.141592653589793);
}
`;
export const EQUIRECT_SAMPLE_WGSL = /* wgsl */ `
fn panoramaSeamlessSample(tex: texture_2d<f32>, samp: sampler, uv: vec2<f32>) -> vec4<f32> {
  let shifted = fract(uv.x + 0.5);
  let dx = vec2<f32>(select(dpdx(shifted), dpdx(uv.x), abs(dpdx(uv.x)) <= abs(dpdx(shifted))), dpdx(uv.y));
  let dy = vec2<f32>(select(dpdy(shifted), dpdy(uv.x), abs(dpdy(uv.x)) <= abs(dpdy(shifted))), dpdy(uv.y));
  return textureSampleGrad(tex, samp, uv, dx, dy);
}
`;
export const EQUIRECT_UV_GLSL = /* glsl */ `
vec2 panoramaEquirectUv(vec3 imageDirection) {
  return panoramaEquirectUvUnit(normalize(imageDirection));
}
`;
export const EQUIRECT_SAMPLE_GLSL = /* glsl */ `
vec4 panoramaSeamlessSample(sampler2D tex, vec2 uv) {
#ifdef PANORAMA_TEXTURE_GRADIENTS
  float shifted = fract(uv.x + 0.5);
  vec2 dx = vec2(abs(dFdx(uv.x)) <= abs(dFdx(shifted)) ? dFdx(uv.x) : dFdx(shifted), dFdx(uv.y));
  vec2 dy = vec2(abs(dFdy(uv.x)) <= abs(dFdy(shifted)) ? dFdy(uv.x) : dFdy(shifted), dFdy(uv.y));
#ifdef PANORAMA_WEBGL2
  return textureGrad(tex, uv, dx, dy);
#else
  return texture2DGradEXT(tex, uv, dx, dy);
#endif
#else
  // WebGL 1 without EXT_shader_texture_lod still draws the same image;
  // its implicit mip gradients can be softer at the longitude seam.
  return texture2D(tex, uv);
#endif
}
`;
export const EQUIRECT_UV_UNIT_GLSL = /* glsl */ `
vec2 panoramaEquirectUvUnit(vec3 d) {
  return vec2(atan(d.x, d.y) / 6.283185307179586 + 0.5, 0.5 - asin(clamp(d.z, -1.0, 1.0)) / 3.141592653589793);
}
`;
